import { Menu } from "@headlessui/react";
import {
  AdjustmentsHorizontalIcon,
  ArrowUpTrayIcon,
  DocumentDuplicateIcon,
  FunnelIcon,
  ListBulletIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { FIELDS } from "@storyflow/backend/fields";
import { getComputationRecord } from "@storyflow/backend/flatten";
import {
  computeFieldId,
  createFieldId,
  minimizeId,
} from "@storyflow/backend/ids";
import { URL_ID } from "@storyflow/backend/templates";
import {
  DBDocument,
  DocumentConfig,
  DocumentId,
  FieldId,
  RestrictTo,
  TemplateFieldId,
} from "@storyflow/backend/types";
import { NoList, useDragItem } from "@storyflow/dnd";
import { ServerPackage } from "@storyflow/state";
import cl from "clsx";
import React from "react";
import { DocumentConfigOp, PropertyOp, targetTools } from "shared/operations";
import {
  useArticle,
  useArticleList,
  useDocumentLabel,
  useSaveArticle,
} from ".";
import { MenuTransition } from "../elements/transitions/MenuTransition";
import { useFolder, useTemplateFolder } from "../folders";
import Content from "../layout/components/Content";
import { useSegment } from "../layout/components/SegmentContext";
import { useOnLoadHandler } from "../layout/onLoadHandler";
import { getPathFromSegment } from "../layout/utils";
import { useCollab } from "../state/collaboration";
import { useDocumentConfig, useFieldConfig } from "../state/documentConfig";
import { useLocalStorage } from "../state/useLocalStorage";
import { FocusOrchestrator, useFocusedIds } from "../utils/useIsFocused";
import { ArticlePageContext } from "./ArticlePageContext";
import { GetArticle } from "./GetArticle";
import { RenderTemplate } from "./RenderTemplate";

export const getVersionKey = (versions?: Record<TemplateFieldId, number>) => {
  if (!versions) return -1;
  return Object.values(versions).reduce((a, c) => a + c, 0);
};

function useIsModified(id: string, initial: boolean, key: number) {
  const [isModified, setIsModified] = React.useState(initial);

  const collab = useCollab();

  React.useEffect(() => {
    return collab.registerMutationListener((doc) => {
      if (doc === id) {
        setIsModified(true);
      }
    });
  }, []);

  React.useEffect(() => {
    setIsModified(initial);
  }, [key, initial]);

  return isModified;
}

export const ArticleContent = ({
  id,
  folder,
  selected,
  label,
  children,
  isModified: initialIsModified,
  variant,
  version,
  toolbar,
}: {
  id: DocumentId;
  folder: string | undefined;
  selected: boolean;
  label: string;
  children: React.ReactNode;
  isModified: boolean;
  variant?: string;
  version: number;
  toolbar: React.ReactNode;
}) => {
  const isModified = useIsModified(id, initialIsModified, version);

  const [isEditing] = useLocalStorage<boolean>("editing-articles", false);

  return (
    <Content
      selected={selected}
      header={
        <Content.Header>
          <div
            className={cl(
              "flex-center h-full font-medium pl-9",
              variant === "template" && "text-teal-500"
            )}
          >
            {label}
            {variant === "template" && (
              <span className="text-sm font-light mt-1 ml-4 text-gray-400">
                <DocumentDuplicateIcon className="w-4 h-4" />
              </span>
            )}
          </div>
        </Content.Header>
      }
      buttons={
        <div
          className={cl(
            "flex-center",
            "transition-opacity",
            isModified ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <span className="text-xs opacity-50 font-light ml-5 cursor-default hover:underline">
            ændret d. 22/2 10:33
          </span>
          {folder && <NewSaveButton id={id} folder={folder} />}
        </div>
      }
      toolbar={isEditing ? toolbar : undefined}
    >
      {children}
    </Content>
  );
};

function Toolbar({ id, config }: { id: DocumentId; config: DocumentConfig }) {
  const ids = useFocusedIds();

  const getFieldIndex = (id: string) => {
    return config.findIndex((el) => "id" in el && el.id === id);
  };

  const index = getFieldIndex(ids[0]);

  if (index >= 0) {
    return (
      <FieldToolbar documentId={id} fieldId={ids[0] as FieldId} index={index} />
    );
  }

  return (
    <Content.Toolbar>
      <NoList>
        <DragButton
          label={"Nyt felt"}
          item={() => ({
            id: createFieldId(id),
            label: "",
            type: "default",
          })}
        />
        <DragButton
          label={"Label"}
          item={() => ({
            ...FIELDS.label,
            id: computeFieldId(id, FIELDS.label.id),
          })}
        />
        <DragButton
          label={"Slug"}
          item={() => ({
            ...FIELDS.slug,
            id: computeFieldId(id, FIELDS.slug.id),
          })}
        />
        <DragButton
          label={"Side"}
          item={{
            ...FIELDS.page,
            id: computeFieldId(id, FIELDS.page.id),
          }}
        />
        <DragButton
          label={"Layout"}
          item={{
            ...FIELDS.layout,
            id: computeFieldId(id, FIELDS.layout.id),
          }}
        />
        <DragButton
          label={"Omdirigering"}
          item={{
            ...FIELDS.redirect,
            id: computeFieldId(id, FIELDS.redirect.id),
          }}
        />
        <DragButton
          label={"Offentlig"}
          item={{
            ...FIELDS.published,
            id: computeFieldId(id, FIELDS.published.id),
          }}
        />
        <DragButton
          label={"Udgivelsesdato"}
          item={{
            ...FIELDS.released,
            id: computeFieldId(id, FIELDS.released.id),
          }}
        />
        <DragButton
          label={"Bruger"}
          item={{
            ...FIELDS.user,
            id: computeFieldId(id, FIELDS.user.id),
          }}
        />
      </NoList>
    </Content.Toolbar>
  );
}

export function FieldToolbar({
  documentId,
  fieldId,
  index,
}: {
  documentId: DocumentId;
  fieldId: FieldId;
  index?: number;
}) {
  const [config, setConfig] = useFieldConfig(fieldId);

  const { push } = useCollab().mutate<DocumentConfigOp>(documentId, documentId);

  const templateFolder = useTemplateFolder()?.id;
  const { articles: templates } = useArticleList(templateFolder);

  const templateOptions = (templates ?? []).map((el) => ({
    id: el.id,
    label: el.label ?? el.id,
  }));

  const restrictToOptions = [{ id: "number" as "number", label: "Tal" }];

  return (
    <Content.Toolbar>
      <div className="text-xs text-gray-300 font-light flex-center h-6 ring-1 ring-inset ring-white/10 px-2 rounded cursor-default">
        Felt: {config?.label || "Ingen label"}
      </div>
      <Content.ToolbarMenu<{ id: DocumentId; label: string }>
        icon={ListBulletIcon}
        label="Vælg template"
        onSelect={(el) => setConfig("template", el.id)}
        onClear={() => setConfig("template", undefined)}
        selected={
          config?.template
            ? templateOptions.find((el) => el.id === config.template)
            : undefined
        }
        options={templateOptions}
      />
      <Content.ToolbarMenu<{ id: RestrictTo; label: string }>
        icon={FunnelIcon}
        label="Begræns til"
        onSelect={(el) => setConfig("restrictTo", el.id)}
        onClear={() => setConfig("restrictTo", undefined)}
        selected={
          config?.restrictTo
            ? restrictToOptions.find((el) => el.id === config.restrictTo)
            : undefined
        }
        options={restrictToOptions}
      />
      {typeof index === "number" && (
        <Content.ToolbarButton
          data-focus-remain="true"
          onClick={() => {
            push({
              target: targetTools.stringify({
                field: "any",
                operation: "document-config",
                location: "",
              }),
              ops: [
                {
                  index,
                  remove: 1,
                },
              ],
            });
          }}
        >
          <TrashIcon className="w-4 h-4" />
        </Content.ToolbarButton>
      )}
    </Content.Toolbar>
  );
}

export default function ArticlePage({
  isOpen,
  isSelected,
  onLoad,
  children,
}: {
  isOpen: boolean;
  isSelected: boolean;
  onLoad?: () => void;
  children?: React.ReactNode;
}) {
  const { current } = useSegment();

  const path = getPathFromSegment(current);
  const [type, articleId] = path.split("/").slice(-1)[0].split("-");

  const id = minimizeId(articleId) as DocumentId;

  let { article, histories, error } = useArticle(id);

  useOnLoadHandler(Boolean(article), onLoad);

  return (
    <>
      {!error && article && (
        <Page
          type={type === "t" ? "template" : "document"}
          isOpen={isOpen}
          article={article}
          histories={histories}
        >
          {children}
        </Page>
      )}
      {!error && !article && <div className=""></div>}
    </>
  );
}

const Page = ({
  type,
  isOpen,
  article,
  histories,
  children,
}: {
  type: "template" | "document";
  isOpen: boolean;
  article: DBDocument;
  histories: Record<string, ServerPackage<DocumentConfigOp | PropertyOp>[]>;
  children: React.ReactNode;
}) => {
  const id = article.id;

  const config = useDocumentConfig(id, {
    config: article.config,
    history: histories[id] ?? [],
    version: article.versions?.[id] ?? 0,
  });

  const folder = useFolder(article.folder);

  const templateId =
    folder?.type === "app" ? URL_ID.slice(0, 4) : folder?.template;

  const owner = article;

  const label = useDocumentLabel(article);

  const isModified = Object.keys(histories ?? {}).length > 0;

  const ctx = React.useMemo(
    () => ({
      id,
      imports: article
        ? getComputationRecord(article, { includeImports: true })
        : {},
      article,
    }),
    [id, article]
  );

  return (
    <FocusOrchestrator>
      <ArticlePageContext.Provider value={ctx}>
        <ArticleContent
          version={getVersionKey(article?.versions)}
          id={id}
          variant={type === "template" ? "template" : undefined}
          folder={article?.folder}
          label={label ?? "Ingen label"}
          selected={isOpen}
          isModified={isModified}
          toolbar={<Toolbar id={id} config={config} />}
        >
          <div className="pb-96 flex flex-col -mt-6">
            {templateId && (
              <GetArticle id={templateId}>
                {(article) => (
                  <RenderTemplate
                    key={getVersionKey(owner.versions)} // for rerendering
                    id={article.id}
                    owner={owner.id}
                    values={{
                      ...getComputationRecord(article),
                      ...getComputationRecord(owner),
                    }}
                    config={article.config}
                    histories={histories}
                    versions={owner.versions}
                  />
                )}
              </GetArticle>
            )}
            <RenderTemplate
              key={getVersionKey(owner.versions)} // for rerendering
              id={owner.id}
              owner={owner.id}
              values={getComputationRecord(owner)}
              config={config}
              versions={owner.versions}
              histories={histories}
            />
          </div>
        </ArticleContent>
        {children}
      </ArticlePageContext.Provider>
    </FocusOrchestrator>
  );
};

function SaveButton({
  id,
  folder,
  isModified,
}: {
  id: string;
  folder: string;
  isModified: boolean;
}) {
  const collab = useCollab();
  const [isLoading, setIsLoading] = React.useState(false);
  const saveArticle = useSaveArticle(folder);
  return (
    <div className="relative z-0">
      {isLoading && (
        <div className="absolute inset-0 bg-amber-500 animate-ping rounded-lg opacity-50 pointer-events-none" />
      )}
      <Content.Button
        icon={ArrowUpTrayIcon}
        onClick={async () => {
          if (isLoading) return;
          setIsLoading(true);
          await collab.sync(true);
          const result = await saveArticle(id);
          setIsLoading(false);
        }}
        className={isModified ? "text-amber-300" : "text-green-300"}
      />
    </div>
  );
}

function NewSaveButton({ id, folder }: { id: string; folder: string }) {
  const collab = useCollab();
  const [isLoading, setIsLoading] = React.useState(false);
  const saveArticle = useSaveArticle(folder);
  return (
    <div className="relative ml-5">
      {/*isLoading && (
        <div className="absolute inset-0 flex-center">
          <div className="w-8 h-8 bg-white/5 rounded-full animate-ping-lg" />
        </div>
      )*/}
      <button
        className="relative z-0 bg-button-teal ring-button text-button rounded px-3 py-1 font-light flex-center gap-2 text-sm overflow-hidden"
        onClick={async () => {
          if (isLoading) return;
          setIsLoading(true);
          await collab.sync(true);
          const result = await saveArticle(id);
          setIsLoading(false);
        }}
      >
        {isLoading && (
          <div className="absolute inset-0 -z-10 flex-center">
            <div className="w-8 h-8 bg-teal-300 rounded-full animate-ping-lg" />
          </div>
        )}
        <ArrowUpTrayIcon className="w-3 h-3" />
        Udgiv
      </button>
    </div>
  );
}

function DragButton({ item, label }: { label: string; item: any }) {
  const { ref, dragHandleProps, state } = useDragItem({
    id: `ny-blok-2-${label}`,
    type: "fields",
    item,
    mode: "move",
  });

  return (
    <Content.ToolbarButton
      ref={ref as React.MutableRefObject<HTMLButtonElement | null>}
      {...dragHandleProps}
    >
      {label}
    </Content.ToolbarButton>
  );
}
