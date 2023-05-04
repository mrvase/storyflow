import React from "react";
import Content from "../pages/Content";
import {
  ArrowPathIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { useDocumentList } from "../documents";
import { createTemplateFieldId } from "@storyflow/fields-core/ids";
import { EditableLabel } from "../elements/EditableLabel";
import cl from "clsx";
import { AddDocumentDialog } from "./AddDocumentDialog";
import type { FieldId } from "@storyflow/shared/types";
import type { DBDocument, DBFolder, SpaceId } from "@storyflow/db-core/types";
import type { SyntaxTreeRecord } from "@storyflow/fields-core/types";
import { SWRClient, useClient } from "../client";
import { useClientConfig } from "../client-config";
import { DomainsButton } from "./FolderPage";
import {
  FolderDomainsContext,
  FolderDomainsProvider,
} from "./FolderDomainsContext";
import { AppSpace } from "./spaces/AppSpace";
import { getFieldRecord, getGraph } from "@storyflow/fields-core/graph";
import { DEFAULT_FIELDS } from "@storyflow/fields-core/default-fields";
import { calculateRootFieldFromRecord } from "@storyflow/fields-core/calculate-server";
import { AppPageContext } from "./AppPageContext";
import { usePanel, useRoute } from "../layout/panel-router/Routes";
import { parseSegment } from "../layout/components/parseSegment";
import { FocusOrchestrator } from "../utils/useIsFocused";
import { usePush } from "../collab/CollabContext";
import { FolderTransactionEntry } from "operations/actions";
import { createTransaction } from "@storyflow/collab/utils";
import { useFolder } from "./FoldersContext";

export default function AppPage({ children }: { children?: React.ReactNode }) {
  const route = useRoute();
  const segment = parseSegment<"app">(route);
  const folder = useFolder(segment.id);

  const [{ path }] = usePanel();
  const isSelected = path === route;

  const { documents } = useDocumentList(folder?._id);

  const orderedDocuments = React.useMemo(() => {
    if (!documents) return [];

    const getUrlLength = (url: string) => {
      return url === "/" ? 0 : url.split("/").length - 1;
    };

    const documentsWithLengths = documents
      .map((el) => {
        const urlId = createTemplateFieldId(el._id, DEFAULT_FIELDS.url.id);
        const url =
          (calculateRootFieldFromRecord(urlId, el.record)?.[0] as string) ?? "";
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

    documentsWithLengths.forEach((doc) => {
      const parentIndex = ordered.findIndex(
        (el) => el.url === doc.url.split("/").slice(0, -1).join("/")
      );
      if (parentIndex >= 0) {
        ordered.splice(parentIndex + 1, 0, doc);
      } else {
        ordered.push(doc);
      }
    });

    return ordered;
  }, [documents]);

  const [dialogIsOpen, setDialogIsOpen] = React.useState<null | string>(null);
  const [parentUrl, setParentUrl] = React.useState<null | {
    id: FieldId;
    record: SyntaxTreeRecord;
    url: string;
  }>(null);

  const addDocumentWithUrl = (parent: Pick<DBDocument, "_id" | "record">) => {
    const urlId = createTemplateFieldId(parent._id, DEFAULT_FIELDS.url.id);
    setDialogIsOpen("add-document");
    setParentUrl({
      id: urlId,
      url:
        (calculateRootFieldFromRecord(urlId, parent.record)?.[0] as string) ??
        "",
      record: getFieldRecord(parent.record, urlId, getGraph(parent.record)),
    });
  };

  const ctx = React.useMemo(
    () => ({
      addDocumentWithUrl,
      urls: orderedDocuments.map((el) => ({
        id: el.urlId,
        value: el.url,
        indent: el.indent,
      })),
    }),
    [orderedDocuments]
  );

  const push = usePush<FolderTransactionEntry>("folders");
  const mutateProp = <T extends "label" | "domains">(
    name: T,
    value: DBFolder[T]
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

  const config = useClientConfig(folder?.domains?.[0]);

  const parentDomains = React.useContext(FolderDomainsContext);

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
                className={cl("text-yellow-400 dark:text-yellow-300")}
              />
            }
            toolbar={
              <Content.Toolbar>
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
              <AddDocumentDialog
                isOpen={dialogIsOpen === "add-document"}
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
            if (revalidateUrl && data?.length) {
              setIsLoading(true);
              const result = await fetch(revalidateUrl, {
                body: JSON.stringify(data),
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
