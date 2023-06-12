import React from "react";
import Content from "../pages/Content";
import {
  ArrowPathIcon,
  ArrowPathRoundedSquareIcon,
  Bars4Icon,
  ComputerDesktopIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  FolderPlusIcon,
  GlobeAltIcon,
  PencilIcon,
  PlusIcon,
  StopIcon,
} from "@heroicons/react/24/solid";
import { EditableLabel } from "../elements/EditableLabel";
import cl from "clsx";
import type { DocumentId } from "@storyflow/shared/types";
import type {
  DBFolder,
  FolderSpace,
  Space,
  SpaceId,
} from "@storyflow/cms/types";
import {
  FolderDomainsContext,
  FolderDomainsProvider,
} from "./FolderDomainsContext";
import { FoldersSpace } from "./spaces/FoldersSpace";
import { createKey } from "../utils/createKey";
import { AddTemplateDialog } from "./AddTemplateDialog";
import { DocumentsSpace } from "./spaces/DocumentsSpace";
import { useDocument } from "../documents";
import { useDocumentLabel } from "../documents/useDocumentLabel";
import { FolderContext } from "./FolderPageContext";
import { useFieldFocus } from "../FieldFocusContext";
import { addNestedFolder } from "../custom-events";
import { parseMatch } from "../layout/components/parseSegment";
import { Menu } from "../elements/Menu";
import { FocusOrchestrator } from "../utils/useIsFocused";
import { usePush } from "../collab/CollabContext";
import { createTransaction } from "@storyflow/collab/utils";
import { FolderTransactionEntry } from "../operations/actions";
import { useFolder } from "./FoldersContext";
import { DropShadow, Sortable } from "@storyflow/dnd";
import { PagesSpace } from "./spaces/PagesSpace";
import { useAppConfig } from "../AppConfigContext";
import { getFolderData } from "./getFolderData";
import { useTranslation } from "../translation/TranslationContext";
import { useOrganization } from "../clients/auth";
import { mutate, query } from "../clients/client";
import { useQuery } from "@nanorpc/client/swr";
import { appMutate } from "../clients/client-app";
import { isError } from "@nanorpc/client";
import { useNavigate, usePath, useRoute } from "@nanokit/router";
import { ROOT_FOLDER } from "@storyflow/cms/constants";
import { DragIcon } from "../elements/DragIcon";

const spaces: { label: string; item: Omit<Space, "id"> }[] = [
  {
    label: "Mapper",
    item: {
      type: "folders",
      items: [],
    } as Omit<FolderSpace, "id">,
  },
  { label: "Dokumenter", item: { type: "documents" } },
  { label: "Hjemmeside", item: { type: "pages" } },
  {
    label: "Statistik",
    item: {
      type: "folders",
      items: [],
    } as Omit<FolderSpace, "id">,
  },
];

export default function FolderPage({
  children,
}: {
  children?: React.ReactNode;
}) {
  const route = useRoute();
  const folder = useFolder(parseMatch<"folder">(route).id);
  const { type } = getFolderData(folder);

  const { pathname } = usePath();

  const isSelected = (pathname || "/") === (route.accumulated || "/");
  const nextIsDocument = pathname
    .slice(route.accumulated.length)
    .startsWith("/d");

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

  const onClick = React.useCallback(
    (item: Omit<Space, "id">) => {
      push(
        createTransaction((t) =>
          t.target(folder._id).splice({
            index: 0,
            insert: [
              {
                ...item,
                id: createKey() as SpaceId,
              } as Space,
            ],
          })
        )
      );
    },
    [folder, push]
  );

  const renderSpace = (space: Space, index: number) => {
    const props = {
      index,
      folderId: folder._id,
      hidden: !isSelected,
    };
    if (space.type === "folders") {
      return <FoldersSpace space={space} key={space.id} {...props} />;
    } else if (space.type === "documents") {
      return <DocumentsSpace space={space} key={space.id} {...props} />;
    } else if (space.type === "pages") {
      return <PagesSpace space={space} key={space.id} {...props} />;
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
      <FolderDomainsProvider domains={folder?.domains}>
        <FocusOrchestrator>
          <Content
            small={!isSelected && nextIsDocument}
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
              <>
                <Content.Toolbar>
                  {type === "data" && (
                    <FolderTemplateButton
                      template={folder?.template}
                      openDialog={() => setTemplateDialogIsOpen(true)}
                    />
                  )}
                  {folder && (
                    <>
                      <DomainsButton
                        parentDomains={parentDomains ?? undefined}
                        domains={folder.domains}
                        mutate={(domains) => mutateProp("domains", domains)}
                      />
                    </>
                  )}
                </Content.Toolbar>
                <Content.Toolbar secondary>
                  <Content.ToolbarDragButton
                    id={`nyt-space-mapper`}
                    type="spaces"
                    icon={DragIcon}
                    label="Mapper"
                    item={spaces[0].item}
                  />
                  <Content.ToolbarDragButton
                    id={`nyt-space-dokumenter`}
                    type="spaces"
                    icon={DragIcon}
                    label="Dokumenter"
                    item={spaces[1].item}
                  />
                  <Menu
                    as={Content.ToolbarButton}
                    label="Andre spaces"
                    icon={StopIcon}
                  >
                    {spaces.slice(2).map((el) => (
                      <Menu.DragItem
                        key={el.label}
                        type="spaces"
                        id={`nyt-space-${el.label}`}
                        icon={DragIcon}
                        onClick={onClick}
                        {...el}
                      />
                    ))}
                  </Menu>
                </Content.Toolbar>
              </>
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
  const t = useTranslation();
  const route = useRoute();
  const navigate = useNavigate();

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
        {t.folders.addTemplate()}
      </Content.ToolbarButton>
    );
  }

  return (
    <Menu as={Content.ToolbarButton} label={label} icon={DocumentDuplicateIcon}>
      <Menu.Item
        icon={PencilIcon}
        label={t.folders.editTemplate({ label: label ?? "" })}
        onClick={() => {
          if (template) {
            navigate(
              `${route.accumulated}/t/${parseInt(template, 16).toString(16)}`
            );
            return;
          }
        }}
      />
      <Menu.Item
        icon={ArrowPathRoundedSquareIcon}
        label={t.folders.changeTemplate()}
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
  const t = useTranslation();

  const organization = useOrganization();

  const getLabel = (domain: string) => {
    domain = domain.replace("https://", "");
    domain = domain.replace("www.", "");
    domain = domain.replace("/api/config", "");
    return domain;
  };

  const options = React.useMemo(() => {
    const options = domains
      .filter((el) => !organization!.apps.some((app) => app.name === el))
      .map((name) => ({
        id: name,
        label: t.folders.unknownDomain(),
        disabled: false,
      }));

    options.push(
      ...organization!.apps.map((el) => ({
        id: el.name,
        label: getLabel(el.baseURL),
        disabled: parentDomains.includes(el.name),
      }))
    );

    return options;
  }, [domains, parentDomains, organization?.apps]);

  const selected = options.filter(
    (el) => parentDomains.includes(el.id) || domains.includes(el.id)
  );

  if (!organization?.apps.length) return null;

  return (
    <Menu<{ id: string; label: string }>
      as={Content.ToolbarButton}
      icon={GlobeAltIcon}
      label={t.folders.websites()}
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
  const t = useTranslation();

  const config = useAppConfig(domain);

  const [isLoading, setIsLoading] = React.useState(false);

  const { data, revalidate } = useQuery(
    query.documents.getUpdatedUrls({
      namespace,
    })
  );

  const count = data?.length ?? 0;

  if (!config) return null;

  return (
    <>
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
              const result = await appMutate.app.revalidatePaths(data);
              if (!isError(result)) {
                await mutate.documents.registerRevalidation();
                revalidate();
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
          <ArrowPathIcon className="w-4 h-4" />
          {t.folders.refresh()}
          {count > 0 && <span>({count})</span>}
        </button>
      </div>
    </>
  );
}
