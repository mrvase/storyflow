import React from "react";
import { getPathFromSegment } from "../layout/utils";
import { useSegment } from "../layout/components/SegmentContext";
import { useOnLoadHandler } from "../layout/onLoadHandler";
import { DropShadow, Sortable, useSortableItem } from "@storyflow/dnd";
import {
  createFieldId,
  getTemplateFieldId,
  minimizeId,
  replaceDocumentId,
} from "@storyflow/backend/ids";
import { useDocumentConfig } from "../state/documentConfig";
import {
  ComputationRecord,
  DBDocument,
  DocumentConfigItem,
  DocumentId,
  FieldConfig,
  HeadingConfig,
  TemplateDocument,
  TemplateFieldId,
} from "@storyflow/backend/types";
import { ArticleContent } from "./ArticleContent";
import useIsFocused from "../utils/useIsFocused";
import cl from "clsx";
import { getTranslateDragEffect } from "../utils/dragEffects";
import {
  PropertyOp,
  targetTools,
  DocumentConfigOp,
  AnyOp,
} from "shared/operations";
import { useFolder } from "../folders";
import { RenderField } from "../fields/RenderField";
import { useArticle, useDocumentLabel } from ".";
import { TEMPLATES, URL_ID } from "@storyflow/backend/templates";
import { FieldType } from "@storyflow/backend/types";
import { getComputationRecord } from "@storyflow/backend/flatten";
import { useCollab } from "../state/collaboration";
import { ServerPackage } from "@storyflow/state";
import { ArticlePageContext } from "./ArticlePageContext";

const getVersionKey = (versions?: Record<TemplateFieldId, number>) => {
  if (!versions) return -1;
  return Object.values(versions).reduce((a, c) => a + c, 0);
};

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
  const id = minimizeId(articleId);

  let { article, histories, error } = useArticle(id);

  useOnLoadHandler(Boolean(article), onLoad);

  const isModified = Object.keys(histories ?? {}).length > 0;

  const ctx = React.useMemo(
    () => ({
      id,
      imports: article
        ? getComputationRecord(article, { includeImports: true })
        : {},
    }),
    [id, article]
  );

  const label = useDocumentLabel(article);

  return (
    <ArticlePageContext.Provider value={ctx}>
      <ArticleContent
        version={getVersionKey(article?.versions)}
        id={id}
        variant={type === "t" ? "template" : undefined}
        folder={article?.folder}
        label={label ?? "Ingen label"}
        selected={isOpen}
        isModified={isModified}
      >
        {!error && article && <Page article={article} histories={histories} />}
        {!error && !article && (
          <div className="text-center py-5 text-xl font-bold text-gray-300"></div>
        )}
      </ArticleContent>
      {children}
    </ArticlePageContext.Provider>
  );
}

const GetArticle = ({
  id,
  children,
}: {
  id: string;
  children: (article: TemplateDocument) => React.ReactNode;
}) => {
  const defaultTemplate = TEMPLATES.find((el) => el.id === id);
  if (defaultTemplate) return <>{children(defaultTemplate)}</>;
  let { article } = useArticle(id);
  if (!article) return null;
  return <>{children(article)}</>;
};

const Page = ({
  article,
  histories,
}: {
  article: DBDocument;
  histories: Record<string, ServerPackage<DocumentConfigOp | PropertyOp>[]>;
}) => {
  const folder = useFolder(article.folder);

  const templateId =
    folder?.type === "app" ? URL_ID.slice(0, 4) : folder?.template;

  const owner = article;

  return (
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
        config={owner.config}
        versions={owner.versions}
        histories={histories}
      />
    </div>
  );
};

function RenderTemplate({
  id,
  owner,
  values,
  config: initialConfig,
  versions,
  histories,
  index = null,
}: {
  id: DocumentId;
  owner: DocumentId;
  values: ComputationRecord;
  config: DBDocument["config"];
  versions?: DBDocument["versions"];
  histories: Record<string, ServerPackage<AnyOp>[]>;
  index?: number | null;
}) {
  const isMain = id === owner;

  const template = isMain
    ? useDocumentConfig(owner, {
        config: initialConfig,
        history: histories[owner] ?? [],
        version: versions?.[owner] ?? 0,
      })
    : initialConfig;

  const { push } = isMain
    ? useCollab().mutate<DocumentConfigOp>(owner, owner)
    : { push: () => {} };

  const handleId = <
    T extends DocumentConfigItem | { __new__: true; type: FieldType }
  >(
    item: T
  ): T extends DocumentConfigItem ? T : FieldConfig => {
    if ("__new__" in item) {
      return {
        id: createFieldId(owner),
        type: item.type,
        label: "",
      } as T extends DocumentConfigItem ? T : FieldConfig;
    }
    return item as T extends DocumentConfigItem ? T : FieldConfig;
  };

  const onChange = (actions: any) => {
    if (!isMain) return;
    const ops = [] as DocumentConfigOp["ops"];
    for (let action of actions) {
      const { type, index } = action;

      if (type === "add") {
        const templateItem = handleId(action.item);
        ops.push({
          index,
          insert: [templateItem],
          remove: 0,
        });
      }

      if (type === "delete") {
        if (!template[index]) return;
        ops.push({
          index,
          insert: [],
          remove: 1,
        });
      }
    }
    push({
      target: targetTools.stringify({
        field: "any",
        operation: "document-config",
        location: "",
      }),
      ops,
    });
  };

  let dragHandleProps: any;
  let draggableContainer = (children: React.ReactNode) => (
    <div className={!isMain ? "" : ""}>{children}</div>
  );

  if (index !== null) {
    const {
      dragHandleProps: dragHandlePropsFromHook,
      ref,
      state,
    } = useSortableItem({
      id,
      index,
      item: {
        template: id,
      },
    });

    dragHandleProps = dragHandlePropsFromHook;

    const style = getTranslateDragEffect(state);

    draggableContainer = (children) => {
      return (
        <div ref={ref} style={style} className="">
          {children}
        </div>
      );
    };
  }

  const render = (fieldRef: DocumentConfigItem, index: number) => {
    if (Array.isArray(fieldRef)) {
      return (
        <RenderRow
          key={fieldRef[0].id}
          index={index}
          row={fieldRef}
          values={values}
          versions={versions}
          histories={histories}
        />
      );
    }

    if ("template" in fieldRef && !("id" in fieldRef)) {
      return (
        <GetArticle id={fieldRef.template} key={fieldRef.template}>
          {(article) => (
            <RenderTemplate
              key={getVersionKey(versions)} // for rerendering
              id={article.id}
              owner={owner}
              values={{ ...values, ...getComputationRecord(article) }}
              config={article.config}
              histories={histories}
              versions={versions}
              index={index}
            />
          )}
        </GetArticle>
      );
    }

    if ("text" in fieldRef) {
      return (
        <RenderHeading
          key={`${fieldRef.text}-${index}`}
          item={fieldRef}
          index={index}
        />
      );
    }

    const fieldId = fieldRef.id
      ? replaceDocumentId(fieldRef.id, owner)
      : createFieldId(owner, id);

    const value = values[fieldId] ?? null;

    return (
      <RenderField
        key={fieldId}
        id={fieldId}
        value={value}
        fieldConfig={handleId({
          ...fieldRef,
          id: fieldId,
        })}
        version={versions?.[getTemplateFieldId(fieldId)] ?? 0}
        history={histories[getTemplateFieldId(fieldId)] ?? []}
        index={index}
        dragHandleProps={dragHandleProps}
      />
    );
  };

  return (
    <>
      {draggableContainer(
        <Sortable
          type="fields"
          id={id}
          onChange={onChange}
          canReceive={{
            link: () => "ignore",
            move: ({ type, item }) => (type === "fields" ? "accept" : "ignore"),
          }}
          disabled={!isMain}
        >
          <div className="flex flex-col">
            {(template ?? []).map(render)}
            <DropShadow>
              {(item) => render(item, (template ?? []).length)}
            </DropShadow>
          </div>
        </Sortable>
      )}
    </>
  );
}

const headers: Record<number, "h1" | "h2" | "h3"> = {
  1: "h1",
  2: "h2",
  3: "h3",
};

function RenderHeading({
  item,
  index,
}: {
  item: HeadingConfig;
  index: number;
}) {
  const { dragHandleProps, ref, state } = useSortableItem({
    id: `${item.text}-${index}`,
    index,
    item,
  });

  const Component = headers[item.level] ?? "h3";

  const style = getTranslateDragEffect(state);

  return (
    <Component
      ref={ref}
      style={style}
      className="text-xl pt-8 pb-8 pl-5"
      {...dragHandleProps}
    >
      {item.text}
    </Component>
  );
}

function RenderRow({
  index,
  row,
  values,
  versions,
  histories,
}: {
  index: number;
  row: FieldConfig[];
  values: ComputationRecord;
  versions: DBDocument["versions"];
  histories: Record<string, ServerPackage<AnyOp>[]>;
}) {
  const { dragHandleProps, ref, state } = useSortableItem({
    id: row[0].id,
    index,
    item: row,
  });

  const style = getTranslateDragEffect(state);

  const { isFocused, handlers } = useIsFocused({
    multiple: true,
    holdShiftKey: true,
    item: row,
  });

  return (
    <div
      ref={ref}
      className={cl(
        isFocused && "ring-1 ring-offset-8 rounded-sm ring-teal-300"
      )}
      style={style}
      {...handlers}
    >
      <div className="flex gap-5 w-full">
        {(row ?? []).map((fieldRef, index) => {
          const value = values[fieldRef.id] ?? null;

          return (
            <RenderField
              key={fieldRef.id}
              id={fieldRef.id}
              value={value}
              fieldConfig={fieldRef}
              version={versions?.[getTemplateFieldId(fieldRef.id)] ?? 0}
              history={histories[getTemplateFieldId(fieldRef.id)]}
              index={index}
              dragHandleProps={dragHandleProps}
            />
          );
        })}
      </div>
    </div>
  );
}
