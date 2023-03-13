import React from "react";
import { getPathFromSegment } from "../layout/utils";
import Content from "../layout/components/Content";
import {
  ArrowPathIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { useArticleList } from "../documents";
import { useSegment } from "../layout/components/SegmentContext";
import { useOnLoadHandler } from "../layout/onLoadHandler";
import { computeFieldId } from "@storyflow/backend/ids";
import { EditableLabel } from "../elements/EditableLabel";
import cl from "clsx";
import { AddArticleDialog } from "./AddArticleDialog";
import {
  DBDocument,
  FieldId,
  DBFolder,
  ComputationRecord,
  FolderId,
  SpaceId,
} from "@storyflow/backend/types";
import { useClient } from "../client";
import { useClientConfig } from "../client-config";
import { unwrap } from "@storyflow/result";
import { DomainsButton } from "./FolderPage";
import { FolderDomainsContext, FolderDomainsProvider } from "./folder-domains";
import { useFolder } from "./collab/hooks";
import { useFolderCollab } from "./collab/FolderCollabContext";
import { targetTools } from "shared/operations";
import { AppSpace } from "./spaces/AppSpace";
import { getFieldRecord, getGraph } from "shared/computation-tools";
import { FIELDS } from "@storyflow/backend/fields";

const AppPageContext = React.createContext<{
  addArticleWithUrl: (parent: Pick<DBDocument, "_id" | "record">) => void;
  urls: { id: FieldId; value: string; indent: number }[];
} | null>(null);

export const useAppPageContext = () => {
  const ctx = React.useContext(AppPageContext);
  if (!ctx) throw new Error("FolderPageContext.Provider not found.");
  return ctx;
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
  const { current } = useSegment();

  const path = getPathFromSegment(current);

  const [type, urlId] = path.split("/").slice(-1)[0].split("-");

  if (!urlId) {
    throw new Error("Invalid url");
  }

  const folderLookupId = urlId as FolderId;
  const folder = useFolder(folderLookupId);

  const { articles } = useArticleList(folder?._id);

  const orderedArticles = React.useMemo(() => {
    if (!articles) return [];

    const getUrlLength = (url: string) => {
      return url ? url.split("/").length : 0;
    };

    const articlesWithLengths = articles
      .map((el) => {
        const urlId = computeFieldId(el._id, FIELDS.url.id);
        const url = (el.record[urlId]?.[0] as string) ?? "";
        return {
          ...el,
          url,
          indent: getUrlLength(url),
          urlId,
        };
      })
      .sort((a, b) => {
        return a.indent - b.indent || (a._id > b._id ? -1 : 1);
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
    record: ComputationRecord;
    url: string;
  }>(null);

  const addArticleWithUrl = (parent: Pick<DBDocument, "_id" | "record">) => {
    const urlId = computeFieldId(parent._id, FIELDS.url.id);
    setDialogIsOpen("add-article");
    setParentUrl({
      id: urlId,
      url: (parent.record[urlId]?.[0] as string) ?? "",
      record: getFieldRecord(parent.record, urlId, getGraph(parent.record)),
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
                      ID: {folder._id}
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
                  namespace={folder._id}
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
              folder={folder._id}
              parentUrl={parentUrl ?? undefined}
              type={type}
            />
          )}
          <div className="flex flex-col">
            <AppSpace
              index={0}
              folderId={folder._id}
              spaceId={"" as SpaceId}
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
            const urls = await client.documents.revalidate.query({
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
