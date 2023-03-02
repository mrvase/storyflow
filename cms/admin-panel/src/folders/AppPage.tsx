import React from "react";
import { useTabUrl } from "../layout/utils";
// import { useFolderTree } from "../folders/useFolderTree";
import { getPathFromSegment } from "../layout/utils";
import Table from "../articles/components/Table";
import Content from "../layout/components/Content";
import { useFolder, useFolderMutation } from ".";
import {
  ArrowPathIcon,
  ComputerDesktopIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  getDocumentLabel,
  useArticleList,
  useArticleListMutation,
} from "../articles";
import { useSegment } from "../layout/components/SegmentContext";
import { useOnLoadHandler } from "../layout/onLoadHandler";
import { computeFieldId, minimizeId, restoreId } from "@storyflow/backend/ids";
import { EditableLabel } from "../elements/EditableLabel";
import cl from "clsx";
import { AddArticleDialog } from "./AddArticleDialog";
import {
  ComputationBlock,
  Computation,
  DBDocument,
  FieldId,
  FlatComputation,
  ComputationRecord,
} from "@storyflow/backend/types";
import {
  getComputationRecord,
  getFlatComputationRecord,
} from "@storyflow/backend/flatten";
import { fieldConfig, getConfig } from "shared/fieldConfig";
import { URL_ID } from "@storyflow/backend/templates";
import { useClient } from "../client";
import { useClientConfig } from "../client-config";
import { unwrap } from "@storyflow/result";
import { useLocalStorage } from "../state/useLocalStorage";
import { DomainsButton } from "./FolderPage";
import { FolderDomainsContext, FolderDomainsProvider } from "./folder-domains";
import { inputConfig } from "shared/inputConfig";

const AppPageContext = React.createContext<{
  addArticleWithUrl: (parent: DBDocument) => void;
  urls: { id: string; value: string; indent: number }[];
} | null>(null);

export const useAppPageContext = () => {
  const ctx = React.useContext(AppPageContext);
  if (!ctx) throw new Error("FolderPageContext.Provider not found.");
  return ctx;
};

const getUrlImports = (article: DBDocument) => {
  const record = getComputationRecord(article);
  const imports = new Set<ComputationBlock>();

  const recursive = (value: Computation) => {
    inputConfig.getImportIds(value, {}).forEach((id) => {
      const block = article.compute.find((el) => el.id === id) ?? {
        id,
        value: getConfig("url").initialValue as FlatComputation,
      };
      imports.add(block);
      const computation = record[id] ?? getConfig("url").initialValue;
      recursive(computation);
    });
  };

  const id = computeFieldId(article.id, URL_ID);
  const value = record[id];

  if (value) recursive(value);

  return Array.from(imports);
};

const getUrlField = (article: DBDocument) => {
  const record = getFlatComputationRecord(article);
  const id = computeFieldId(article.id, URL_ID);
  const value = record[id] ?? getConfig("url").initialValue;
  const url = (article.values[URL_ID]?.[0] as string) ?? "";

  return {
    id,
    value,
    url,
  };
};

export default function AppPage({
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
  const folder = useFolder(folderLookupId);

  const { articles } = useArticleList(folder?.id);

  const orderedArticles = React.useMemo(() => {
    if (!articles) return [];

    const getUrlLength = (url: string) => {
      return url ? url.split("/").length : 0;
    };

    const articlesWithLengths = articles
      .map((el) => {
        const { url } = getUrlField(el);
        return {
          ...el,
          url,
          indent: getUrlLength(url),
          urlId: `${el.id}${URL_ID}`,
        };
      })
      .sort((a, b) => {
        return a.indent - b.indent || (a.id > b.id ? -1 : 1);
      });

    const ordered: (DBDocument & {
      indent: number;
      url: string;
      urlId: string;
    })[] = [];

    articlesWithLengths.forEach((article) => {
      const parentIndex = ordered.findIndex(
        (el) => el.url === article.url.split("/").slice(0, -1).join("/")
      );
      if (parentIndex >= 0) {
        ordered.splice(parentIndex + 1, 0, article);
      } else {
        ordered.push(article);
      }
    });

    return ordered;
  }, [articles]);

  useOnLoadHandler(Boolean(articles), onLoad);

  const [dialogIsOpen, setDialogIsOpen] = React.useState<null | string>(null);
  const [parentUrl, setParentUrl] = React.useState<null | {
    id: FieldId;
    value: FlatComputation;
    url: string;
    imports: ComputationBlock[];
  }>(null);

  const addArticleWithUrl = (parent: DBDocument) => {
    setDialogIsOpen("add-article");
    setParentUrl({
      ...getUrlField(parent),
      imports: getUrlImports(parent),
    });
  };

  const ctx = React.useMemo(
    () => ({
      addArticleWithUrl,
      urls: orderedArticles.map((el) => ({
        id: el.urlId,
        value: el.url,
        indent: el.indent,
      })),
    }),
    [orderedArticles]
  );

  const mutate = useFolderMutation(folder?.id ?? "");

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

  const config = useClientConfig(folder?.domains?.[0]);

  const parentDomains = React.useContext(FolderDomainsContext);
  const [isEditing] = useLocalStorage<boolean>("editing-articles", false);

  return (
    <AppPageContext.Provider value={ctx}>
      <FolderDomainsProvider domains={folder?.domains ?? []}>
        <Content
          selected={isOpen}
          header={
            <Content.Header>
              <div className="flex-center h-full font-medium">
                <span className="text-sm font-light mt-1 mr-5 text-yellow-300">
                  <ComputerDesktopIcon className="w-4 h-4" />
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
                  className={cl("font-medium", "text-yellow-300")}
                />
              </div>
            </Content.Header>
          }
          toolbar={
            isEditing ? (
              <Content.Toolbar>
                {folder && (
                  <>
                    <DomainsButton
                      parentDomains={parentDomains ?? undefined}
                      domains={folder.domains}
                      mutate={mutate}
                    />
                    <div className="text-xs text-gray-300 font-light flex-center h-6 ring-1 ring-inset ring-white/10 px-2 rounded cursor-default">
                      ID: {restoreId(folder.id)}
                    </div>
                  </>
                )}
              </Content.Toolbar>
            ) : null
          }
          buttons={
            <div
              className={cl(
                "flex-center",
                "transition-opacity",
                true ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              <span className="text-xs opacity-50 font-light ml-5 cursor-default hover:underline">
                x sider ændret
              </span>
              {folder && config.revalidateUrl && (
                <RefreshButton
                  namespace={restoreId(folder.id)}
                  revalidateUrl={config.revalidateUrl}
                />
              )}
            </div>
          }
        >
          {folder && (
            <AddArticleDialog
              isOpen={dialogIsOpen === "add-article"}
              close={() => {
                setDialogIsOpen(null);
                setParentUrl(null);
              }}
              folder={folder.id}
              parentUrl={parentUrl ?? undefined}
              type={type}
            />
          )}
          {folder && articles ? (
            <div className="flex flex-col px-5">
              <div className="flex items-center ml-9 mb-1 justify-between">
                <h2 className=" text-gray-400">Data</h2>
                <div className="flex gap-2">
                  <button
                    className="px-3 rounded py-1.5 ring-button text-button"
                    onClick={handleDelete}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <form ref={form} onSubmit={(ev) => ev.preventDefault()}>
                <Table
                  rows={orderedArticles.map((el) => ({
                    id: restoreId(el.id),
                    columns: [
                      { value: getDocumentLabel(el) },
                      {
                        value: (
                          <button
                            className="rounded px-2 py-0.5 text-sm text-gray-800 dark:text-white text-opacity-50 hover:text-opacity-100 dark:text-opacity-50 dark:hover:text-opacity-100 ring-button flex items-center gap-2 whitespace-nowrap"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              addArticleWithUrl(el);
                            }}
                          >
                            <PlusIcon className="w-3 h-3" /> Tilføj underside
                          </button>
                        ),
                      },
                    ],
                    indent: el.indent,
                  }))}
                />
              </form>
            </div>
          ) : (
            <div className="text-center py-5 text-xl font-bold text-gray-300">
              Vent et øjeblik
            </div>
          )}
        </Content>
        {children}
      </FolderDomainsProvider>
    </AppPageContext.Provider>
  );
}

function RefreshButton({
  namespace,
  revalidateUrl,
}: {
  namespace: string;
  revalidateUrl: string;
}) {
  const [isLoading, setIsLoading] = React.useState(false);

  const client = useClient();

  return (
    <div className="relative ml-5">
      {/*isLoading && (
        <div className="absolute inset-0 flex-center">
          <div className="w-8 h-8 bg-white/5 rounded-full animate-ping-lg" />
        </div>
      )*/}
      <button
        className="relative z-0 bg-button-yellow ring-button text-button rounded px-3 py-1 font-light flex-center gap-2 text-sm overflow-hidden"
        onClick={async () => {
          if (revalidateUrl) {
            setIsLoading(true);
            const urls = await client.articles.revalidate.query({
              namespace,
              domain: "",
              revalidateUrl,
            });
            console.log(namespace, urls);
            await fetch(revalidateUrl, {
              body: JSON.stringify(unwrap(urls, []).map((el) => `/${el}`)),
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
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
  );
}
