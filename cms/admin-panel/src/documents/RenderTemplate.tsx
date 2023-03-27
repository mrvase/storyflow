import React from "react";
import { DropShadow, Sortable, useSortableItem } from "@storyflow/dnd";
import { createTemplateFieldId, getRawFieldId } from "@storyflow/backend/ids";
import {
  SyntaxTreeRecord,
  DBDocument,
  DocumentConfigItem,
  DocumentId,
  HeadingConfig,
  SyntaxTree,
} from "@storyflow/backend/types";
import { getTranslateDragEffect } from "../utils/dragEffects";
import { targetTools, DocumentConfigOp, AnyOp } from "shared/operations";
import { RenderField } from "../fields/RenderField";
import { useDocumentMutate } from "./collab/DocumentCollabContext";
import { ServerPackage } from "@storyflow/state";
import { getVersionKey } from "./DocumentPage";
import { GetDocument } from "./GetDocument";
import { ExtendTemplatePath } from "./TemplatePathContext";

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
  values: SyntaxTreeRecord;
  config: DBDocument["config"];
  versions?: DBDocument["versions"];
  histories: Record<string, ServerPackage<AnyOp>[]>;
  index?: number | null;
}) {
  const isMain = id === owner;

  const { push } = isMain
    ? useDocumentMutate<DocumentConfigOp>(owner, owner)
    : { push: () => {} };

  const onChange = React.useCallback(
    (actions: any) => {
      if (!isMain) return;
      const ops = [] as DocumentConfigOp["ops"];
      for (let action of actions) {
        const { type, index } = action;

        if (type === "add") {
          const templateItem = {
            ...action.item,
          };
          ops.push({
            index,
            insert: [templateItem],
          });
        }

        if (type === "delete") {
          if (!config[index]) return;
          ops.push({
            index,
            remove: 1,
          });
        }
      }
      push({
        target: targetTools.stringify({
          operation: "document-config",
          location: "",
        }),
        ops,
      });
    },
    [config, push]
  );

  React.useEffect(() => {
    console.log("changing onchange config");
  }, [config]);

  React.useEffect(() => {
    console.log("changing onchange push");
  }, [push]);

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
        <GetDocument id={fieldConfig.template} key={fieldConfig.template}>
          {(article) => (
            <RenderTemplate
              key={getVersionKey(versions)} // for rerendering
              id={article._id}
              owner={owner}
              values={{ ...values, ...article.record }}
              config={article.config}
              histories={histories}
              versions={versions}
              index={index}
            />
          )}
        </GetDocument>
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

    const fieldId = isMain
      ? fieldConfig.id
      : createTemplateFieldId(owner, fieldConfig.id);

    const value: SyntaxTree | undefined = values[fieldId];

    return (
      <RenderField
        key={fieldId}
        id={fieldId}
        value={value}
        fieldConfig={{
          ...fieldConfig,
          id: fieldId,
        }}
        version={versions?.[getRawFieldId(fieldId)] ?? 0}
        history={histories[getRawFieldId(fieldId)] ?? []}
        index={index}
        dragHandleProps={dragHandleProps}
      />
    );
  };

  return (
    <ExtendTemplatePath template={id}>
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
    </ExtendTemplatePath>
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
