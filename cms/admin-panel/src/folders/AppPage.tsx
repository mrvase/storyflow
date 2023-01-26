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
} from "@storyflow/backend/types";
import { getComputationRecord } from "@storyflow/backend/flatten";
import { getConfig } from "shared/fieldConfig";
import { URL_ID } from "@storyflow/backend/templates";
import { useClient } from "../client";
import { useClientConfig } from "../client-config";

const AppPageContext = React.createContext<{
  addArticleWithUrl: (parentUrl: { id: FieldId; value: Computation }) => void;
  urls: { id: string; value: string; indent: number }[];
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
  const { current, full } = useSegment();

  const path = getPathFromSegment(current);

  const [type, urlId] = path.split("/").slice(-1)[0].split("-");
  const folderLookupId = urlId ? minimizeId(urlId) : undefined;
  const folder = useFolder(folderLookupId);

  const { articles } = useArticleList(folder?.id);

  const orderedArticles = React.useMemo(() => {
    if (!articles) return [];

    const getUrlField = (article: DBDocument) => {
      const id = computeFieldId(article.id, URL_ID);
      const computation: Computation | null = getComputationRecord(article)[id];
      const value: Computation = computation ?? getConfig("url").initialValue;
      const url = (article.values[URL_ID]?.[0] as string) ?? "";

      return {
        id,
        value,
        url,
      };
    };

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
    value: Computation;
  }>(null);

  const ctx = React.useMemo(
    () => ({
      addArticleWithUrl: (parentUrl: { id: FieldId; value: Computation }) => {
        setDialogIsOpen("add-article");
        setParentUrl(parentUrl);
      },
      urls: orderedArticles.map((el) => ({
        id: el.urlId,
        value: el.url,
        indent: el.indent,
      })),
    }),
    [orderedArticles]
  );

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

  const client = useClient();
  const config = useClientConfig();

  return (
    <AppPageContext.Provider value={ctx}>
      <Content
        variant="app"
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
                className={cl("font-medium", "text-yellow-300")}
              />
              <span className="text-sm font-light mt-1 ml-4 text-gray-400">
                <ComputerDesktopIcon className="w-4 h-4" />
              </span>
            </div>
          </Content.Header>
        }
        buttons={
          <Content.Buttons>
            <Content.Button
              icon={ArrowPathIcon}
              onClick={async () => {
                if (config.revalidateUrl) {
                  const result = await client.articles.revalidate.mutation({
                    domain: "",
                    revalidateUrl: config.revalidateUrl,
                  });
                }
              }}
            />
            <Content.Button icon={TrashIcon} onClick={() => handleDelete()} />
            <Content.Button
              icon={PlusIcon}
              onClick={() => setDialogIsOpen("add-article")}
            />
          </Content.Buttons>
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
            parentUrl={parentUrl ?? true}
            type={type}
          />
        )}
        {folder && articles ? (
          <div className="flex flex-col p-5">
            <form ref={form} onSubmit={(ev) => ev.preventDefault()}>
              <Table
                rows={orderedArticles.map((el) => ({
                  id: restoreId(el.id),
                  columns: [
                    { name: el.id, value: false },
                    { value: getDocumentLabel(el) },
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
    </AppPageContext.Provider>
  );
}
