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
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Dialog from "../elements/Dialog";
import {
  getDocumentLabel,
  useArticleList,
  useArticleListMutation,
} from "../articles";
import { useSegment } from "../layout/components/SegmentContext";
import { useOnLoadHandler } from "../layout/onLoadHandler";
import { minimizeId, restoreId } from "@storyflow/backend/ids";
import { useArticleIdGenerator, useFolderIdGenerator } from "../id-generator";
import { EditableLabel } from "../elements/EditableLabel";
import cl from "clsx";
import { AddArticleDialog } from "./AddArticleDialog";
import { DBFolder } from "@storyflow/backend/types";
import { useContextWithError } from "../utils/contextError";

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

  return (
    <FolderContext.Provider value={folder}>
      <Content
        selected={isOpen}
        header={
          <Content.Header>
            <div className="flex-center h-full pl-2.5 font-medium">
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
              <span className="text-sm font-light mt-1 ml-4 text-gray-400">
                <FolderIcon className="w-4 h-4" />
              </span>
            </div>
          </Content.Header>
        }
        buttons={
          <Content.Buttons>
            <Content.Button icon={TrashIcon} onClick={() => handleDelete()} />
            <Content.Button
              icon={FolderPlusIcon}
              onClick={() => setDialogIsOpen("add-folder")}
            />
            {folder?.type === "data" && (
              <Content.Button
                onClick={() => {
                  if (folder?.template) {
                    navigateTab(`${current}/t-${restoreId(folder.template)}`);
                    return;
                  }
                  setDialogIsOpen("add-template");
                }}
                className="bg-teal-800 hover:bg-teal-600"
              >
                {folder?.template ? "Skabelon" : "Tilføj skabelon"}
              </Content.Button>
            )}
            <Content.Button
              icon={PlusIcon}
              onClick={() => setDialogIsOpen("add-article")}
            />
          </Content.Buttons>
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
            <AddArticleDialog
              isOpen={dialogIsOpen === "add-article"}
              close={() => {
                setDialogIsOpen(null);
              }}
              folder={folder.id}
              template={folder.template}
              type={type}
            />
          </>
        )}
        {folder && articles ? (
          <div className="flex flex-col p-5">
            <FolderGrid
              parent={folder}
              folders={folders!}
              disabled={!isSelected}
              cols={cols}
            />
            {folder.type === "data" && (
              <form ref={form} onSubmit={(ev) => ev.preventDefault()}>
                <Table
                  rows={articles.map((el) => ({
                    id: restoreId(el.id),
                    columns: [
                      { name: el.id, value: false },
                      { value: getDocumentLabel(el) },
                    ],
                  }))}
                />
              </form>
            )}
          </div>
        ) : (
          <div className="text-center py-5 text-xl font-bold text-gray-300">
            {/*Vent et øjeblik*/}
          </div>
        )}
      </Content>
      {children}
    </FolderContext.Provider>
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

  return (
    <Dialog isOpen={isOpen} close={close} title="Tilføj mappe">
      <form
        onSubmit={async (ev) => {
          ev.preventDefault();
          const data = new FormData(ev.target as HTMLFormElement);
          const id = await generateId();
          mutate({
            type: "reorder",
            children: [
              {
                id,
                index: Math.random().toString(36).slice(2, 6),
                after: null,
              },
            ],
            insert: {
              id,
              label: (data.get("label") as string) ?? "",
              type: (data.get("type") as "data") ?? "data",
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
