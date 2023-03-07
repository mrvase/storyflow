import React from "react";
import { DropShadow, Sortable, useSortableItem } from "@storyflow/dnd";
import {
  createFieldId,
  getTemplateFieldId,
  replaceDocumentId,
} from "@storyflow/backend/ids";
import { useDocumentConfig } from "../state/documentConfig";
import {
  ComputationRecord,
  DBDocument,
  DocumentConfigItem,
  DocumentId,
  HeadingConfig,
} from "@storyflow/backend/types";
import { getTranslateDragEffect } from "../utils/dragEffects";
import {
  PropertyOp,
  targetTools,
  DocumentConfigOp,
  AnyOp,
} from "shared/operations";
import { RenderField } from "../fields/RenderField";
import { URL_ID } from "@storyflow/backend/templates";
import { getComputationRecord } from "@storyflow/backend/flatten";
import { useDocumentCollab } from "../state/collab-document";
import { ServerPackage } from "@storyflow/state";
import { getVersionKey } from "./ArticlePage";
import { GetArticle } from "./GetArticle";

export function RenderTemplate({
  id,
  owner,
  values,
  config,
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

  const { push } = isMain
    ? useDocumentCollab().mutate<DocumentConfigOp>(owner, owner)
    : { push: () => {} };

  const onChange = React.useCallback(
    (actions: any) => {
      if (!isMain) return;
      const ops = [] as DocumentConfigOp["ops"];
      for (let action of actions) {
        const { type, index } = action;

        if (type === "add") {
          const templateItem = action.item;
          ops.push({
            index,
            insert: [templateItem],
            remove: 0,
          });
        }

        if (type === "delete") {
          if (!config[index]) return;
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
    },
    [config, push]
  );

  let dragHandleProps: any = undefined;
  let containerProps = {};

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

    const style = getTranslateDragEffect(state);

    dragHandleProps = dragHandlePropsFromHook;
    containerProps = { ref, style };
  }

  const renderConfigElement = (
    fieldConfig: DocumentConfigItem,
    index: number
  ) => {
    if (Array.isArray(fieldConfig)) {
      return null;
    }

    if ("template" in fieldConfig && !("id" in fieldConfig)) {
      return (
        <GetArticle id={fieldConfig.template} key={fieldConfig.template}>
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

    if ("text" in fieldConfig) {
      return (
        <RenderHeading
          key={`${fieldConfig.text}-${index}`}
          item={fieldConfig}
          index={index}
        />
      );
    }

    const fieldId = fieldConfig.id
      ? replaceDocumentId(fieldConfig.id, owner)
      : createFieldId(owner, id);

    const value = values[fieldId] ?? null;

    return (
      <RenderField
        key={fieldId}
        id={fieldId}
        value={value}
        fieldConfig={{
          ...fieldConfig,
          id: fieldId,
        }}
        version={versions?.[getTemplateFieldId(fieldId)] ?? 0}
        history={histories[getTemplateFieldId(fieldId)] ?? []}
        index={index}
        dragHandleProps={dragHandleProps}
        template={id}
      />
    );
  };

  return (
    <div {...containerProps}>
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
          {(config ?? []).map(renderConfigElement)}
          <DropShadow>
            {(item) => renderConfigElement(item, (config ?? []).length)}
          </DropShadow>
        </div>
      </Sortable>
    </div>
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
