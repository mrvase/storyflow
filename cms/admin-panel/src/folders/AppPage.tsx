import React from "react";
import Content from "../layout/components/Content";
import {
  ArrowPathIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { useOptimisticDocumentList } from "../documents";
import { createTemplateFieldId } from "@storyflow/backend/ids";
import { EditableLabel } from "../elements/EditableLabel";
import cl from "clsx";
import { AddArticleDialog } from "./AddArticleDialog";
import {
  DBDocument,
  FieldId,
  DBFolder,
  SpaceId,
  SyntaxTreeRecord,
} from "@storyflow/backend/types";
import { SWRClient, useClient } from "../client";
import { useClientConfig } from "../client-config";
import { DomainsButton } from "./FolderPage";
import {
  FolderDomainsContext,
  FolderDomainsProvider,
} from "./FolderDomainsContext";
import { useFolder } from "./collab/hooks";
import { useFolderCollab } from "./collab/FolderCollabContext";
import { targetTools } from "shared/operations";
import { AppSpace } from "./spaces/AppSpace";
import { getFieldRecord, getGraph } from "shared/computation-tools";
import { DEFAULT_FIELDS } from "@storyflow/backend/fields";
import { calculateFromRecord } from "@storyflow/backend/calculate";
import { AppPageContext } from "./AppPageContext";
import { usePanel, useRoute } from "../panel-router/Routes";
import { parseSegment } from "../layout/components/routes";
import { FocusOrchestrator } from "../utils/useIsFocused";

export default function AppPage({ children }: { children?: React.ReactNode }) {
  const route = useRoute();
  const segment = parseSegment<"app">(route);
  const folder = useFolder(segment.id);

  const [{ path }] = usePanel();
  const isSelected = path === route;

  const { articles } = useOptimisticDocumentList(folder?._id);

  const orderedArticles = React.useMemo(() => {
    if (!articles) return [];

    const getUrlLength = (url: string) => {
      return url ? url.split("/").length : 0;
    };

    const articlesWithLengths = articles
      .map((el) => {
        const urlId = createTemplateFieldId(el._id, DEFAULT_FIELDS.url.id);
        const url =
          (calculateFromRecord(urlId, el.record)?.[0] as string) ?? "";
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

  const [dialogIsOpen, setDialogIsOpen] = React.useState<null | string>(null);
  const [parentUrl, setParentUrl] = React.useState<null | {
    id: FieldId;
    record: SyntaxTreeRecord;
    url: string;
  }>(null);

  const addArticleWithUrl = (parent: Pick<DBDocument, "_id" | "record">) => {
    const urlId = createTemplateFieldId(parent._id, DEFAULT_FIELDS.url.id);
    setDialogIsOpen("add-article");
    setParentUrl({
      id: urlId,
      url: (calculateFromRecord(urlId, parent.record)?.[0] as string) ?? "",
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
        <FocusOrchestrator>
          <Content
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
                        ID: {folder._id.replace(/^0+/, "")}
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
                type="app"
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
        </FocusOrchestrator>
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

  const { data, mutate } = SWRClient.documents.getUpdatedUrls.useQuery({
    namespace,
  });

  const client = useClient();

  const number = data?.length ?? 0;

  return (
    <>
      {number > 0 && (
        <span
          title={(data ?? []).map((el) => `/${el}`).join(", ")}
          className="text-xs opacity-50 font-light ml-5 cursor-default hover:underline"
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
          className="relative z-0 bg-button-yellow ring-button-yellow text-button rounded px-3 py-1 font-light flex-center gap-2 text-sm overflow-hidden"
          onClick={async () => {
            if (revalidateUrl && data?.length) {
              setIsLoading(true);
              const result = await fetch(revalidateUrl, {
                body: JSON.stringify(data.map((el) => `/${el}`)),
                method: "POST",
                headers: { "Content-Type": "application/json" },
              }).then((res) => res.json());
              await client.documents.revalidated.mutation();
              if (result.revalidated === true) {
              }
              mutate();
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
