import React from "react";
import { useTabUrl } from "../layout/utils";
import { getPathFromSegment } from "../layout/utils";
import Content from "../layout/components/Content";
import {
  ArrowPathRoundedSquareIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  GlobeAltIcon,
  PencilIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useSegment } from "../layout/components/SegmentContext";
import { useOnLoadHandler } from "../layout/onLoadHandler";
import { EditableLabel } from "../elements/EditableLabel";
import cl from "clsx";
import {
  DBFolder,
  DocumentId,
  FolderId,
  SpaceId,
} from "@storyflow/backend/types";
import { SWRClient } from "../client";
import { FolderDomainsContext, FolderDomainsProvider } from "./folder-domains";
import { useFolder } from "./collab/hooks";
import { useFolderCollab } from "./collab/FolderCollabContext";
import { FolderGridSpace } from "./spaces/FolderGridSpace";
import { targetTools } from "shared/operations";
import { createKey } from "../utils/createKey";
import { AddTemplateDialog } from "./AddTemplateDialog";
import { DocumentListSpace } from "./spaces/DocumentListSpace";
import { useArticle } from "../documents";
import { useDocumentLabel } from "../documents/useDocumentLabel";
import { FolderContext } from "./FolderPageContext";
import { ROOT_FOLDER } from "@storyflow/backend/constants";
import { useFieldFocus } from "../field-focus";
import { addNestedFolder } from "../custom-events";

export default function FolderPage({
  isOpen,
  isSelected,
  onLoad,
  numberOfVisibleTabs,
  children,
}: {
  isOpen: boolean;
  isSelected: boolean;
  onLoad?: () => void;
  numberOfVisibleTabs: number;
  children?: React.ReactNode;
}) {
  const { current } = useSegment();

  const path = getPathFromSegment(current);

  const [, urlId] = path.split("/").slice(-1)[0].split("-");
  const folderLookupId = (urlId ?? ROOT_FOLDER) as FolderId;
  const folder = useFolder(folderLookupId);

  useOnLoadHandler(true, onLoad);

  const cols = {
    1: "grid-cols-4",
    2: "grid-cols-2",
    3: "grid-cols-1",
    4: "grid-cols-1",
  }[numberOfVisibleTabs]!;

  const [dialogIsOpen, setDialogIsOpen] = React.useState<null | string>(null);

  const [isEditing] = [true]; //useLocalStorage<boolean>("editing-articles", false);

  const parentDomains = React.useContext(FolderDomainsContext);

  const collab = useFolderCollab();

  const mutateProp = <T extends keyof DBFolder>(
    name: T,
    value: DBFolder[T]
  ) => {
    return collab.mutate("folders", folder._id).push({
      target: targetTools.stringify({
        location: "",
        operation: "property",
      }),
      ops: [
        {
          name,
          value,
        },
      ],
    });
  };

  return (
    <FolderContext.Provider value={folder}>
      <FolderDomainsProvider domains={folder?.domains ?? []}>
        <Content
          selected={isOpen}
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
            isEditing ? (
              <Content.Toolbar>
                <FolderTemplateButton
                  template={folder?.template}
                  openDialog={() => setDialogIsOpen("add-template")}
                />
                <Content.ToolbarButton
                  data-focus-remain="true"
                  onClick={() => {
                    collab.mutate("folders", folder._id).push({
                      target: targetTools.stringify({
                        operation: "folder-spaces",
                        location: "",
                      }),
                      ops: [
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
                    });
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
                    <div className="text-xs text-gray-600 font-light flex-center h-6 ring-1 ring-inset ring-gray-700 px-2 rounded cursor-default">
                      ID: {folder._id.replace(/^0+/, "")}
                    </div>
                  </>
                )}
              </Content.Toolbar>
            ) : null
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
                spaceId={"" as SpaceId}
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
  const { current } = useSegment();
  const [, navigateTab] = useTabUrl();

  const { article } = useArticle(template);
  const label = useDocumentLabel(article);

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
    <Content.ToolbarMenu
      label={`Skabelon: ${label}`}
      icon={DocumentDuplicateIcon}
    >
      <Content.ToolbarMenuOption
        icon={PencilIcon}
        label={`Rediger skabelon "${label}"`}
        onClick={() => {
          if (template) {
            navigateTab(`${current}/t-${template}`);
            return;
          }
        }}
      />
      <Content.ToolbarMenuOption
        icon={ArrowPathRoundedSquareIcon}
        label="Skift skabelon"
        onClick={() => {
          openDialog();
        }}
      />
    </Content.ToolbarMenu>
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
  }, [domains]);

  const selected = options.filter(
    (el) => parentDomains.includes(el.id) || domains.includes(el.id)
  );

  if (!data?.domains || data.domains.length === 0) return null;

  return (
    <Content.ToolbarMenu<{ id: string; label: string }>
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
