import React from "react";
import { getPathFromSegment } from "../layout/utils";
import Content from "../layout/components/Content";
import {
  ArrowPathIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { useArticleList } from "../articles";
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
  DBFolder,
} from "@storyflow/backend/types";
import {
  getComputationRecord,
  getFlatComputationRecord,
} from "@storyflow/backend/flatten";
import { getConfig } from "shared/fieldConfig";
import { URL_ID } from "@storyflow/backend/templates";
import { useClient } from "../client";
import { useClientConfig } from "../client-config";
import { unwrap } from "@storyflow/result";
import { useLocalStorage } from "../state/useLocalStorage";
import { DomainsButton } from "./FolderPage";
import { FolderDomainsContext, FolderDomainsProvider } from "./folder-domains";
import { inputConfig } from "shared/inputConfig";
import { useFolder, useFolderCollab } from "../state/collab-folder";
import { targetTools } from "shared/operations";
import { AppSpace } from "./spaces/AppSpace";

const AppPageContext = React.createContext<{
  addArticleWithUrl: (parent: DBDocument) => void;
  urls: { id: FieldId; value: string; indent: number }[];
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
  if (!urlId) {
    throw new Error("Invalid url");
  }
  const folderLookupId = minimizeId(urlId);
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
          urlId: computeFieldId(el.id, URL_ID),
        };
      })
      .sort((a, b) => {
        return a.indent - b.indent || (a.id > b.id ? -1 : 1);
      });

    const ordered: (DBDocument & {
      indent: number;
      url: string;
      urlId: FieldId;
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

  useOnLoadHandler(true, onLoad);

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

  const collab = useFolderCollab();
  const mutateProp = <T extends keyof DBFolder>(
    name: T,
    value: DBFolder[T]
  ) => {
    return collab.mutate("folders", folder.id).push({
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

  const config = useClientConfig(folder?.domains?.[0]);

  const parentDomains = React.useContext(FolderDomainsContext);

  const [isEditing] = [true]; //useLocalStorage<boolean>("editing-articles", false);

  return (
    <AppPageContext.Provider value={ctx}>
      <FolderDomainsProvider domains={folder?.domains ?? []}>
        <Content
          selected={isOpen}
          icon={ComputerDesktopIcon}
          header={
            <EditableLabel
              value={folder?.label ?? ""}
              onChange={(value) => {
                mutateProp("label", value);
              }}
              className={cl("text-yellow-300")}
            />
          }
          toolbar={
            isEditing ? (
              <Content.Toolbar>
                {folder && (
                  <>
                    <DomainsButton
                      parentDomains={parentDomains ?? undefined}
                      domains={folder.domains}
                      mutate={(domains) => mutateProp("domains", domains)}
                    />
                    <div className="text-xs text-gray-600 font-light flex-center h-6 ring-1 ring-inset ring-gray-700 px-2 rounded cursor-default">
                      ID: {restoreId(folder.id)} ({folder.id})
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
          <div className="flex flex-col">
            <AppSpace
              index={0}
              folderId={folder.id}
              spaceId={""}
              hidden={!isSelected}
            />
          </div>
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
        className="relative z-0 bg-button-yellow ring-button-yellow text-button rounded px-3 py-1 font-light flex-center gap-2 text-sm overflow-hidden"
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
