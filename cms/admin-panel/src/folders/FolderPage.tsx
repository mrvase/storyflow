import React from "react";
import { useTabUrl } from "../layout/utils";
// import { useFolderTree } from "../folders/useFolderTree";
import { getPathFromSegment } from "../layout/utils";
import Table from "../articles/components/Table";
import Content from "../layout/components/Content";
import FolderGrid from "./components/FolderGrid";
import { useFolder, useFolderMutation, useFolders, useTemplateFolder } from ".";
import {
  FolderIcon,
  FolderPlusIcon,
  GlobeAltIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Dialog from "../elements/Dialog";
import {
  getDefaultValuesFromTemplateAsync,
  getDocumentLabel,
  useArticleList,
  useArticleListMutation,
} from "../articles";
import { useSegment } from "../layout/components/SegmentContext";
import { useOnLoadHandler } from "../layout/onLoadHandler";
import {
  getDocumentId,
  minimizeId,
  replaceDocumentId,
  restoreId,
} from "@storyflow/backend/ids";
import { useArticleIdGenerator, useFolderIdGenerator } from "../id-generator";
import { EditableLabel } from "../elements/EditableLabel";
import cl from "clsx";
import { AddArticleDialog } from "./AddArticleDialog";
import { DBFolder, DocumentId } from "@storyflow/backend/types";
import { useContextWithError } from "../utils/contextError";
import { useLocalStorage } from "../state/useLocalStorage";
import { SWRClient, useClient } from "../client";
import { FolderDomainsContext, FolderDomainsProvider } from "./folder-domains";
import { tools } from "shared/editor-tools";
import { CREATION_DATE_ID } from "@storyflow/backend/templates";

const FolderContext = React.createContext<DBFolder | undefined | null>(null);
export const useCurrentFolder = () =>
  useContextWithError(FolderContext, "Folder");

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
  const { current, full } = useSegment();

  const path = getPathFromSegment(current);

  const [type, urlId] = path.split("/").slice(-1)[0].split("-");
  const folderLookupId = urlId ? minimizeId(urlId) : undefined;

  const { folders } = useFolders();
  const folder = useFolder(folderLookupId);

  const templateFolderId = useTemplateFolder()?.id;

  const { articles } = useArticleList(folder?.id);

  useOnLoadHandler(Boolean(articles), onLoad);

  const cols = {
    1: "grid-cols-4",
    2: "grid-cols-2",
    3: "grid-cols-1",
    4: "grid-cols-1",
  }[numberOfVisibleTabs]!;

  const [dialogIsOpen, setDialogIsOpen] = React.useState<null | string>(null);

  const mutate = useFolderMutation(folder?.id ?? "");

  const [, navigateTab] = useTabUrl();

  const form = React.useRef<HTMLFormElement | null>(null);

  const mutateArticles = useArticleListMutation();

  const handleDelete = () => {
    if (form.current && folder?.id) {
      const data = new FormData(form.current);
      const ids = Array.from(data.keys());
      if (ids.length) {
        mutateArticles({
          folder: folder.id,
          actions: ids.map((id) => ({
            type: "remove",
            id,
          })),
        });
      }
    }
  };

  const [isEditing] = useLocalStorage<boolean>("editing-articles", false);

  const parentDomains = React.useContext(FolderDomainsContext);

  return (
    <FolderContext.Provider value={folder}>
      <FolderDomainsProvider domains={folder?.domains ?? []}>
        <Content
          selected={isOpen}
          header={
            <Content.Header>
              <div className="flex-center h-full font-medium">
                <span className="text-sm font-light mt-0.5 mr-5 text-gray-400">
                  <FolderIcon className="w-4 h-4" />
                </span>
                <EditableLabel
                  value={folder?.label ?? ""}
                  onChange={(value) => {
                    if (folder) {
                      mutate({
                        name: "label",
                        value,
                      });
                    }
                  }}
                  className={cl("font-medium")}
                />
              </div>
            </Content.Header>
          }
          toolbar={
            isEditing ? (
              <Content.Toolbar>
                <Content.ToolbarButton
                  data-focus-remain="true"
                  onClick={() => {
                    if (folder?.template) {
                      navigateTab(`${current}/t-${restoreId(folder.template)}`);
                      return;
                    }
                    setDialogIsOpen("add-template");
                  }}
                >
                  {folder?.template ? "Skabelon" : "Tilføj skabelon"}
                </Content.ToolbarButton>
                {folder && (
                  <DomainsButton
                    parentDomains={parentDomains ?? undefined}
                    domains={folder.domains}
                    mutate={mutate}
                  />
                )}
              </Content.Toolbar>
            ) : null
          }
        >
          {folder && templateFolderId && (
            <>
              <AddFolderDialog
                isOpen={dialogIsOpen === "add-folder"}
                close={() => setDialogIsOpen(null)}
                parent={folder.id}
              />
              <AddTemplateDialog
                isOpen={dialogIsOpen === "add-template"}
                close={() => setDialogIsOpen(null)}
                label={folder.label}
                parent={folder.id}
                templateFolder={templateFolderId}
              />
            </>
          )}
          {folder && articles ? (
            <div className="flex flex-col gap-8 px-5">
              <div>
                <div className="flex items-center ml-9 mb-3.5 justify-between">
                  <h2 className=" text-gray-400">Undermapper</h2>
                  <div className="flex gap-2">
                    <button
                      className="px-3 rounded py-1.5 ring-button text-button"
                      onClick={() => setDialogIsOpen("add-folder")}
                    >
                      <FolderPlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <FolderGrid
                  parent={folder}
                  folders={folders!}
                  disabled={!isSelected}
                  cols={cols}
                />
              </div>
              <div>
                <div className="flex items-center ml-9 mb-1 justify-between">
                  <h2 className=" text-gray-400">Data</h2>
                  <div className="flex gap-2">
                    <button
                      className="px-3 rounded py-1.5 ring-button text-button"
                      onClick={handleDelete}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                    <AddArticleButton
                      folder={folder.id}
                      template={folder.template}
                    />
                  </div>
                </div>
                {folder.type === "data" && (
                  <form ref={form} onSubmit={(ev) => ev.preventDefault()}>
                    <Table
                      rows={articles.map((el) => ({
                        id: restoreId(el.id),
                        columns: [{ value: getDocumentLabel(el) }],
                      }))}
                    />
                  </form>
                )}
              </div>
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

function AddArticleButton({
  folder,
  template,
}: {
  folder: string;
  template?: DocumentId;
}) {
  const mutateArticles = useArticleListMutation();
  const generateId = useArticleIdGenerator();
  const [, navigateTab] = useTabUrl();
  const { current } = useSegment();
  const client = useClient();
  return (
    <button
      className="px-3 rounded py-1.5 ring-button text-button"
      onClick={async () => {
        const id = await generateId();
        const defaultValues = template
          ? await getDefaultValuesFromTemplateAsync(template, client)
          : null;
        const compute = (defaultValues?.compute ?? []).map((block) => ({
          id: replaceDocumentId(block.id, id),
          value: block.value.map((el) =>
            tools.isFieldImport(el)
              ? {
                  ...el,
                  fref:
                    getDocumentId(block.id) === getDocumentId(el.fref)
                      ? replaceDocumentId(el.fref, id)
                      : el.fref,
                }
              : el
          ),
        }));
        mutateArticles({
          folder,
          actions: [
            {
              type: "insert",
              id,
              values: Object.assign(defaultValues?.values ?? {}, {
                [CREATION_DATE_ID]: [new Date()],
              }),
              compute,
            },
          ],
        });
        navigateTab(`${current}/d-${restoreId(id)}`, { navigate: true });
      }}
    >
      <PlusIcon className="w-4 h-4" />
    </button>
  );
}

export function DomainsButton({
  parentDomains = [],
  domains = [],
  mutate,
}: {
  parentDomains?: string[];
  domains?: string[];
  mutate: ReturnType<typeof useFolderMutation>;
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
        mutate({
          name: "domains",
          value: newDomains,
        });
      }}
      selected={selected}
      options={options}
      multi
    />
  );
}

function AddFolderDialog({
  isOpen,
  close,
  parent,
}: {
  isOpen: boolean;
  close: () => void;
  parent: string;
}) {
  const mutate = useFolderMutation(parent);
  const generateId = useFolderIdGenerator();
  const generateFrontId = useArticleIdGenerator();

  return (
    <Dialog isOpen={isOpen} close={close} title="Tilføj mappe">
      <form
        onSubmit={async (ev) => {
          ev.preventDefault();
          const data = new FormData(ev.target as HTMLFormElement);
          const type = (data.get("type") as "data" | "app") ?? "data";
          const label = (data.get("label") as string) ?? "";
          const [id, frontId] = await Promise.all([
            generateId(),
            type === "app" ? generateFrontId() : ("" as DocumentId),
          ]);
          mutate({
            type: "reorder",
            children: [
              {
                id,
                index: Math.random().toString(36).slice(2, 6),
                after: null,
              },
            ],
            insert:
              type === "app"
                ? {
                    id,
                    label,
                    type,
                    frontId,
                  }
                : {
                    id,
                    label,
                    type,
                  },
          });
          close();
        }}
      >
        <div className="flex flex-col gap-2 mb-4">
          <div className="text-sm font-normal mb-1">Navn</div>
          <input
            type="text"
            name="label"
            className="bg-white/5 rounded py-2 px-2.5 outline-none w-full"
            autoComplete="off"
          />
          <label className="relative z-0 block p-5 w-full">
            <input
              type="radio"
              name="type"
              value="data"
              defaultChecked
              className="peer w-0 h-0"
            />{" "}
            <div className="absolute peer-focus:ring-2 ring-yellow-300 inset-0 -z-10 bg-white/5 peer-checked:bg-white/20 transition-colors duration-75 rounded"></div>
            Mappe
          </label>
          <label className="relative z-0 block p-5 w-full">
            <input
              type="radio"
              name="type"
              value="app"
              className="peer w-0 h-0"
            />{" "}
            <div className="absolute peer-focus:ring-2 ring-yellow-300 inset-0 -z-10 bg-white/5 peer-checked:bg-white/20 transition-colors duration-75 rounded"></div>
            App
          </label>
        </div>
        <div className="flex flex-row-reverse mt-5 gap-2">
          <button
            type="submit"
            className="h-8 px-3 flex-center bg-white/10 hover:bg-white/20 rounded font-normal text-sm transition-colors"
          >
            Opret
          </button>
          <button
            className="h-8 px-3 flex-center bg-black/10 hover:bg-black/20 rounded font-normal text-sm transition-colors"
            onClick={(ev) => {
              ev.preventDefault();
              close();
            }}
          >
            Annuller
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function AddTemplateDialog({
  isOpen,
  close,
  label,
  parent,
  templateFolder,
}: {
  isOpen: boolean;
  close: () => void;
  label: string;
  parent: string;
  templateFolder: string;
}) {
  const mutateArticles = useArticleListMutation();
  const mutate = useFolderMutation(parent);
  const generateId = useArticleIdGenerator();

  return (
    <Dialog isOpen={isOpen} close={close} title="Tilføj skabelon">
      <form
        onSubmit={async (ev) => {
          ev.preventDefault();
          const data = new FormData(ev.target as HTMLFormElement);
          const id = await generateId();
          mutateArticles({
            folder: templateFolder,
            actions: [
              {
                type: "insert",
                id,
                label: (data.get("label") as string) ?? "",
                compute: [],
                values: {},
              },
            ],
          });
          mutate({
            name: "template",
            value: id,
          });
          close();
        }}
      >
        <div className="text-sm font-normal mb-1">Navn</div>
        <input
          type="text"
          name="label"
          className="bg-white/5 rounded py-2 px-2.5 outline-none w-full"
        />
        <div className="flex flex-row-reverse mt-5 gap-2">
          <button
            type="submit"
            className="h-8 px-3 flex-center bg-white/10 hover:bg-white/20 rounded font-normal text-sm transition-colors"
          >
            Opret
          </button>
          <button
            className="h-8 px-3 flex-center bg-black/10 hover:bg-black/20 rounded font-normal text-sm transition-colors"
            onClick={(ev) => {
              ev.preventDefault();
              close();
            }}
          >
            Annuller
          </button>
        </div>
      </form>
    </Dialog>
  );
}
