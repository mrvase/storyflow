import React from "react";
import Content from "../pages/Content";
import {
  ArrowPathIcon,
  ArrowPathRoundedSquareIcon,
  ComputerDesktopIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  GlobeAltIcon,
  PencilIcon,
  PlusIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import { EditableLabel } from "../elements/EditableLabel";
import cl from "clsx";
import type { DocumentId } from "@storyflow/shared/types";
import type { DBFolder, Space, SpaceId } from "@storyflow/cms/types";
import {
  FolderDomainsContext,
  FolderDomainsProvider,
} from "./FolderDomainsContext";
import { FolderGridSpace } from "./spaces/FolderGridSpace";
import { createKey } from "../utils/createKey";
import { AddTemplateDialog } from "./AddTemplateDialog";
import { DocumentListSpace } from "./spaces/DocumentListSpace";
import { useDocument } from "../documents";
import { useDocumentLabel } from "../documents/useDocumentLabel";
import { FolderContext } from "./FolderPageContext";
import { useFieldFocus } from "../field-focus";
import { addNestedFolder } from "../custom-events";
import { usePanel, useRoute } from "../layout/panel-router/Routes";
import { parseSegment } from "../layout/components/parseSegment";
import { Menu } from "../elements/Menu";
import { FocusOrchestrator } from "../utils/useIsFocused";
import { usePush } from "../collab/CollabContext";
import { createTransaction } from "@storyflow/collab/utils";
import { FolderTransactionEntry } from "../operations/actions";
import { useFolder } from "./FoldersContext";
import { useAuth } from "../Auth";
import { DropShadow, Sortable } from "@storyflow/dnd";
import { AppSpace } from "./spaces/AppSpace";
import { useAppConfig } from "../client-config";
import { SWRClient, useClient, useAppClient } from "../client";
import { isSuccess } from "@storyflow/rpc-client/result";
import { getFolderData } from "./getFolderData";

const spaces = [
  {
    label: "Mapper",
    item: {
      type: "folders",
      items: [],
    },
  },
  { label: "Dokumenter", item: { type: "documents" } },
  { label: "Hjemmeside", item: { type: "pages" } },
  {
    label: "Statistik",
    item: {
      type: "folders",
      items: [],
    },
  },
];

export default function FolderPage({
  children,
}: {
  children?: React.ReactNode;
}) {
  const route = useRoute();
  const segment = parseSegment<"folder">(route);
  const folder = useFolder(segment.id);
  const { type } = getFolderData(folder);

  const [{ path }] = usePanel();
  const isSelected = (path || "/") === (route || "/");

  const push = usePush<FolderTransactionEntry>("folders");
  const mutateProp = <T extends "label" | "domains">(
    name: T,
    value: { label: string; domains: string[] }[T]
  ) => {
    return push(
      createTransaction((t) =>
        t.target(folder._id).toggle({
          name,
          value,
        } as any)
      )
    );
  };

  const [templateDialogIsOpen, setTemplateDialogIsOpen] =
    React.useState<boolean>(false);
  const parentDomains = React.useContext(FolderDomainsContext);

  const onChange = React.useCallback(
    (actions: any) => {
      if (!isSelected) return;
      push(
        createTransaction((t) => {
          t.target(folder._id);

          for (let action of actions) {
            const { type, index } = action;

            if (type === "add") {
              t.splice({
                index,
                insert: [
                  {
                    id: createKey(),
                    ...action.item,
                  },
                ],
              });
            }

            if (type === "delete") {
              t.splice({
                index,
                remove: 1,
              });
            }
          }

          return t;
        })
      );
    },
    [folder, push]
  );

  const renderSpace = (space: Space, index: number) => {
    const props = {
      key: space.id,
      index,
      folderId: folder._id,
      hidden: !isSelected,
    };
    if (space.type === "folders") {
      return <FolderGridSpace space={space} {...props} />;
    } else if (space.type === "documents") {
      return <DocumentListSpace space={space} {...props} />;
    } else if (space.type === "pages") {
      return <AppSpace space={space} {...props} />;
    }
    return null;
  };

  /* ADD SPACE
  push(
    createTransaction((t) =>
      t.target(folder._id).splice({
        index: 0,
        insert: [
          {
            id: createKey() as SpaceId,
            type: "folders",
            items: [],
          },
        ],
      })
    )
  );
  */

  return (
    <FolderContext.Provider value={folder}>
      <FolderDomainsProvider domains={folder?.domains ?? []}>
        <FocusOrchestrator>
          <Content
            icon={type === "app" ? ComputerDesktopIcon : FolderIcon}
            header={
              <FolderLabel
                isApp={type === "app"}
                folder={folder}
                onChange={(value) => {
                  mutateProp("label", value);
                }}
              />
            }
            toolbar={
              <Content.Toolbar>
                {type === "data" && (
                  <FolderTemplateButton
                    template={folder?.template}
                    openDialog={() => setTemplateDialogIsOpen(true)}
                  />
                )}
                <Menu
                  as={Content.ToolbarButton}
                  label="Tilføj space"
                  icon={StopIcon}
                >
                  {spaces.map((el) => (
                    <Menu.DragItem
                      key={el.label}
                      type="spaces"
                      id={`nyt-space-${el.label}`}
                      {...el}
                    />
                  ))}
                </Menu>
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
            buttons={
              type === "app" && folder ? (
                <div
                  className={cl(
                    "flex-center",
                    "transition-opacity",
                    true ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}
                >
                  <RefreshButton
                    namespace={folder._id}
                    domain={folder?.domains?.[0]}
                  />
                </div>
              ) : undefined
            }
          >
            {folder && (
              <>
                <AddTemplateDialog
                  isOpen={templateDialogIsOpen}
                  close={() => setTemplateDialogIsOpen(false)}
                  folderId={folder._id}
                  currentTemplate={folder.template}
                />
                <Sortable
                  type="spaces"
                  id={`${folder._id}-spaces`}
                  onChange={onChange}
                  canReceive={{
                    link: () => "ignore",
                    move: ({ type, item }) =>
                      type === "spaces" ? "accept" : "ignore",
                  }}
                  disabled={!isSelected}
                >
                  <div className="flex flex-col gap-8">
                    {(folder.spaces ?? []).map(renderSpace)}
                    <DropShadow>
                      {(item) =>
                        renderSpace(item, (folder.spaces ?? []).length)
                      }
                    </DropShadow>
                  </div>
                </Sortable>
              </>
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
  isApp,
}: {
  folder: DBFolder;
  onChange: (label: string) => void;
  isApp: boolean;
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
      className={cl(
        isApp ? "text-yellow-400 dark:text-yellow-300" : "font-medium"
      )}
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
  const { label } = useDocumentLabel(doc);

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
  const { organization } = useAuth();

  const getLabel = (domain: string) => {
    domain = domain.replace("https://", "");
    domain = domain.replace("www.", "");
    domain = domain.replace("/api/config", "");
    return domain;
  };

  const options = React.useMemo(() => {
    return organization!.apps.map((el) => ({
      id: el.name,
      label: getLabel(el.baseURL),
      disabled: parentDomains.includes(el.name),
    }));
  }, [organization?.apps]);

  const selected = options.filter(
    (el) => parentDomains.includes(el.id) || domains.includes(el.id)
  );

  if (!organization?.apps.length) return null;

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

function RefreshButton({
  namespace,
  domain,
}: {
  namespace: string;
  domain?: string;
}) {
  const config = useAppConfig(domain);

  const [isLoading, setIsLoading] = React.useState(false);

  const { data, mutate } = SWRClient.documents.getUpdatedUrls.useQuery({
    namespace,
  });

  const client = useClient();
  const appClient = useAppClient();

  const number = data?.length ?? 0;

  if (!config) return null;

  return (
    <>
      {number > 0 && (
        <span
          title={(data ?? []).join(", ")}
          className="text-xs opacity-50 ml-5 cursor-default hover:underline"
        >
          {number} {number === 1 ? "side" : "sider"} ændret
        </span>
      )}
      <div className="relative ml-5">
        {/*isLoading && (
        <div className="absolute inset-0 flex-center">
          <div className="w-8 h-8 bg-white/5 rounded-full animate-ping-lg" />
        </div>
      )*/}
        <button
          className="relative z-0 bg-button-yellow ring-button-yellow text-button rounded px-3 py-1 flex-center gap-2 text-sm overflow-hidden"
          onClick={async () => {
            if (config.baseURL && data?.length) {
              setIsLoading(true);
              const result = await appClient.app.revalidate.mutation(data);
              if (isSuccess(result)) {
                await client.documents.registerRevalidation.mutation();
                mutate();
              }
              setIsLoading(false);
            }
          }}
        >
          {isLoading && (
            <div className="absolute inset-0 -z-10 flex-center">
              <div className="w-8 h-8 bg-teal-300 rounded-full animate-ping-lg" />
            </div>
          )}
          <ArrowPathIcon className="w-3 h-3" />
          Opdater
        </button>
      </div>
    </>
  );
}
