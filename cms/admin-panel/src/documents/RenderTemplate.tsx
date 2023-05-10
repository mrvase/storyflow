import React from "react";
import { DropShadow, Sortable, useSortableItem } from "@storyflow/dnd";
import {
  createTemplateFieldId,
  getDocumentId,
  getRawFieldId,
} from "@storyflow/cms/ids";
import type { DocumentId, FieldId } from "@storyflow/shared/types";
import type {
  DocumentConfigItem,
  HeadingConfig,
  DBDocument,
  SyntaxTreeRecord,
} from "@storyflow/cms/types";
import type { SyntaxTree } from "@storyflow/cms/types";
import { getTranslateDragEffect } from "../utils/dragEffects";
import { RenderField } from "../fields/RenderField";
import { useCollab, usePush } from "../collab/CollabContext";
import { GetDocument } from "./GetDocument";
import { ExtendTemplatePath } from "./TemplatePathContext";
import { TopFieldIndexProvider } from "./FieldIndexContext";
import { useClient } from "../client";
import { useDocumentIdGenerator } from "../id-generator";
import {
  getDefaultValuesFromTemplateAsync,
  pushDefaultValues,
} from "./template-fields";
import { splitTransformsAndRoot } from "@storyflow/cms/transform";
import { createTokenStream } from "../operations/parse-token-stream";
import {
  DocumentSpliceOperation,
  DocumentTransactionEntry,
  FieldTransactionEntry,
} from "../operations/actions";
import { createTransaction } from "@storyflow/collab/utils";
import { Timeline } from "@storyflow/collab/Timeline";

export function RenderTemplate({
  id,
  owner,
  config,
  versions,
  index,
}: {
  id: DocumentId;
  owner: DocumentId;
  config: DBDocument["config"];
  versions: DBDocument["versions"];
  index: number | null;
}) {
  const isMain = id === owner;

  const push = isMain
    ? usePush<DocumentTransactionEntry>(owner, "config")
    : () => {};

  const collab = useCollab();

  const client = useClient();
  const generateDocumentId = useDocumentIdGenerator();

  const onChange = React.useCallback(
    (actions: any) => {
      if (!isMain) return;
      const ops = [] as DocumentSpliceOperation[];
      for (let action of actions) {
        const { type, index } = action;

        if (type === "add") {
          const templateItem = {
            ...action.item,
          };
          ops.push([index, 0, [templateItem]]);

          getDefaultValuesFromTemplateAsync(owner, templateItem.template, {
            client,
            generateDocumentId,
          }).then((defaultValues) => {
            const timeline = collab.getTimeline(owner);
            if (timeline) {
              pushDefaultValues(timeline, {
                id: owner,
                record: defaultValues,
              });
            }
          });
        }

        if (type === "delete") {
          if (!config[index]) return;
          ops.push([index, 1]);
        }
      }
      push([["", ops]]);
    },
    [config, push, client, generateDocumentId, collab, owner]
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
    } else if ("text" in fieldConfig) {
      return (
        <RenderHeading
          key={`${fieldConfig.text}-${index}`}
          item={fieldConfig}
          index={index}
        />
      );
    } else if ("template" in fieldConfig && !("id" in fieldConfig)) {
      return (
        <TopFieldIndexProvider index={index} key={fieldConfig.template}>
          <GetDocument id={fieldConfig.template}>
            {(doc) => (
              <RenderTemplate
                // key={getVersionKey(versions)} // for rerendering
                id={doc._id}
                owner={owner}
                config={doc.config}
                versions={versions}
                index={index}
              />
            )}
          </GetDocument>
        </TopFieldIndexProvider>
      );
    } else {
      const fieldId = isMain
        ? fieldConfig.id
        : createTemplateFieldId(owner, fieldConfig.id);

      return (
        <TopFieldIndexProvider index={index} key={fieldId}>
          <RenderField
            id={fieldId}
            fieldConfig={{
              ...fieldConfig,
              id: fieldId,
            }}
            index={index}
            dragHandleProps={dragHandleProps}
          />
        </TopFieldIndexProvider>
      );
    }
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
