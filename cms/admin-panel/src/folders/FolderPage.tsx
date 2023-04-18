import React from "react";
import Content from "../layout/components/Content";
import {
  ArrowPathRoundedSquareIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  GlobeAltIcon,
  PencilIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { EditableLabel } from "../elements/EditableLabel";
import cl from "clsx";
import { DBFolder, DocumentId, SpaceId } from "@storyflow/backend/types";
import { SWRClient } from "../client";
import {
  FolderDomainsContext,
  FolderDomainsProvider,
} from "./FolderDomainsContext";
import { useFolder } from "./collab/hooks";
import { useFolderCollab } from "./collab/FolderCollabContext";
import { FolderGridSpace } from "./spaces/FolderGridSpace";
import { createKey } from "../utils/createKey";
import { AddTemplateDialog } from "./AddTemplateDialog";
import { DocumentListSpace } from "./spaces/DocumentListSpace";
import { useDocument } from "../documents";
import { useDocumentLabel } from "../documents/useDocumentLabel";
import { FolderContext } from "./FolderPageContext";
import { useFieldFocus } from "../field-focus";
import { addNestedFolder } from "../custom-events";
import { usePanel, useRoute } from "../panel-router/Routes";
import { parseSegment } from "../layout/components/routes";
import { Menu } from "../layout/components/Menu";
import { FocusOrchestrator } from "../utils/useIsFocused";

export default function FolderPage({
  children,
}: {
  children?: React.ReactNode;
}) {
  const route = useRoute();
  const segment = parseSegment<"folder">(route);
  const folder = useFolder(segment.id);

  const [{ path }] = usePanel();
  const isSelected = (path || "/") === (route || "/");

  const [dialogIsOpen, setDialogIsOpen] = React.useState<null | string>(null);

  const parentDomains = React.useContext(FolderDomainsContext);

  const collab = useFolderCollab();

  const mutateProp = <T extends keyof DBFolder>(
    name: T,
    value: DBFolder[T]
  ) => {
    return collab.mutate("folders", folder._id).push([
      "",
      [
        {
          name,
          value,
        },
      ],
    ]);
  };

  return (
    <FolderContext.Provider value={folder}>
      <FolderDomainsProvider domains={folder?.domains ?? []}>
        <FocusOrchestrator>
          <Content
            icon={FolderIcon}
            header={
              <FolderLabel
                folder={folder}
                onChange={(value) => {
                  mutateProp("label", value);
                }}
              />
            }
            toolbar={
              <Content.Toolbar>
                <FolderTemplateButton
                  template={folder?.template}
                  openDialog={() => setDialogIsOpen("add-template")}
                />
                <Content.ToolbarButton
                  data-focus-remain="true"
                  onClick={() => {
                    collab.mutate("folders", folder._id).push([
                      "",
                      [
                        {
                          index: 0,
                          insert: [
                            {
                              id: createKey(),
                              type: "folders",
                              items: [],
                            },
                          ],
                        },
                      ],
                    ]);
                  }}
                  icon={PlusIcon}
                >
                  Tilføj space
                </Content.ToolbarButton>
                {folder && (
                  <>
                    <DomainsButton
                      parentDomains={parentDomains ?? undefined}
                      domains={folder.domains}
                      mutate={(domains) => mutateProp("domains", domains)}
                    />
                    <div className="text-xs text-gray-600 flex-center h-6 ring-1 ring-inset ring-gray-700 px-2 rounded cursor-default">
                      ID: {folder._id.replace(/^0+/, "")}
                    </div>
                  </>
                )}
              </Content.Toolbar>
            }
          >
            {folder && (
              <>
                <AddTemplateDialog
                  isOpen={dialogIsOpen === "add-template"}
                  close={() => setDialogIsOpen(null)}
                  folderId={folder._id}
                  currentTemplate={folder.template}
                />
              </>
            )}
            {folder ? (
              <div className="flex flex-col gap-8">
                {(folder.spaces ?? []).map((space, index) => {
                  if (space.type === "folders") {
                    return (
                      <FolderGridSpace
                        key={space.id}
                        index={index}
                        spaceId={space.id}
                        folderId={folder._id}
                        hidden={!isSelected}
                      />
                    );
                  }
                  return null;
                })}
                <DocumentListSpace
                  index={0}
                  spaceId={`${folder._id}-documents` as SpaceId}
                  folderId={folder._id}
                  hidden={!isSelected}
                />
              </div>
            ) : (
              <div className="text-center py-5 text-xl font-bold text-gray-300">
                {/*Vent et øjeblik*/}
              </div>
            )}
          </Content>
        </FocusOrchestrator>
        {children}
      </FolderDomainsProvider>
    </FolderContext.Provider>
  );
}

function FolderLabel({
  folder,
  onChange,
}: {
  folder: DBFolder;
  onChange: (label: string) => void;
}) {
  const [focused] = useFieldFocus();

  return focused ? (
    <div
      className="py-0.5 cursor-alias"
      onMouseDown={(ev) => {
        if (!focused) return;
        ev.preventDefault();
        addNestedFolder.dispatch({
          folderId: folder._id,
          templateId: folder.template,
        });
      }}
    >
      {folder.label ?? ""}
    </div>
  ) : (
    <EditableLabel
      value={folder.label ?? ""}
      onChange={onChange}
      className={cl("font-medium")}
    />
  );
}

export function FolderTemplateButton({
  template,
  openDialog,
}: {
  template?: DocumentId;
  openDialog: () => void;
}) {
  const route = useRoute();
  const [{ path }, navigate] = usePanel();

  const { doc } = useDocument(template);
  const label = useDocumentLabel(doc);

  if (!template) {
    return (
      <Content.ToolbarButton
        data-focus-remain="true"
        onClick={() => {
          openDialog();
        }}
        icon={DocumentDuplicateIcon}
      >
        Tilføj skabelon
      </Content.ToolbarButton>
    );
  }

  return (
    <Menu
      as={Content.ToolbarButton}
      label={`Skabelon: ${label}`}
      icon={DocumentDuplicateIcon}
    >
      <Menu.Item
        icon={PencilIcon}
        label={`Rediger skabelon "${label}"`}
        onClick={() => {
          if (template) {
            navigate(`${route}/t${parseInt(template, 16).toString(16)}`, {
              navigate: true,
            });
            return;
          }
        }}
      />
      <Menu.Item
        icon={ArrowPathRoundedSquareIcon}
        label="Skift skabelon"
        onClick={() => {
          openDialog();
        }}
      />
    </Menu>
  );
}

export function DomainsButton({
  parentDomains = [],
  domains = [],
  mutate,
}: {
  parentDomains?: string[];
  domains?: string[];
  mutate: (domains: string[]) => void;
}) {
  const { data } = SWRClient.settings.get.useQuery();

  const getLabel = (domain: string) => {
    domain = domain.replace("https://", "");
    domain = domain.replace("www.", "");
    domain = domain.replace("/api/config", "");
    return domain;
  };

  const options = React.useMemo(() => {
    if (!data?.domains) return [];
    return data.domains.map((el) => ({
      id: el.id,
      label: getLabel(el.configUrl),
      disabled: parentDomains.includes(el.id),
    }));
  }, [data?.domains]);

  const selected = options.filter(
    (el) => parentDomains.includes(el.id) || domains.includes(el.id)
  );

  if (!data?.domains || data.domains.length === 0) return null;

  return (
    <Menu<{ id: string; label: string }>
      as={Content.ToolbarButton}
      icon={GlobeAltIcon}
      label="Hjemmesider"
      onSelect={(selected) => {
        const newDomains = domains.includes(selected.id)
          ? domains.filter((el) => el !== selected.id)
          : [...domains, selected.id];
        mutate(newDomains);
      }}
      selected={selected}
      options={options}
      multi
    />
  );
}
