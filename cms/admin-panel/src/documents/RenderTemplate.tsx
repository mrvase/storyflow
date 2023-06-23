import React from "react";
import cl from "clsx";
import { DropShadow, Sortable, useSortableItem } from "@storyflow/dnd";
import { createTemplateFieldId } from "@storyflow/cms/ids";
import type { DocumentId } from "@storyflow/shared/types";
import type {
  DocumentConfigItem,
  HeadingConfig,
  DBDocument,
} from "@storyflow/cms/types";
import { getTranslateDragEffect } from "../utils/dragEffects";
import { RenderField } from "../fields/RenderField";
import { collab, usePush } from "../collab/CollabContext";
import { GetDocument } from "./GetDocument";
import { ExtendTemplatePath, useTemplatePath } from "./TemplatePathContext";
import { TopFieldIndexProvider } from "./FieldIndexContext";
import { useDocumentIdGenerator } from "../id-generator";
import {
  getDefaultValuesFromTemplateAsync,
  pushDefaultValues,
} from "./template-fields";
import {
  DocumentSpliceOperation,
  DocumentTransactionEntry,
} from "../operations/actions";
import { useLocalStorage } from "../state/useLocalStorage";

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
    [config, push, generateDocumentId, owner]
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
            fieldId={fieldId}
            fieldConfig={
              fieldConfig
            } /* this does not have the correct id, but this is fixed in RenderField */
            index={index}
            dragHandleProps={dragHandleProps}
          />
        </TopFieldIndexProvider>
      );
    }
  };

  const depth = useTemplatePath().length;
  const [isOpen] = useLocalStorage<boolean>("toolbar-open", true);

  const isDraggableUnit = depth === 1 && isOpen;

  return (
    <ExtendTemplatePath template={id}>
      <div {...containerProps} className="relative">
        {isDraggableUnit && (
          <div className="absolute z-50 inset-0 border border-sky-100 rounded m-2.5 pointer-events-none" />
        )}
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
          {(config ?? []).map(renderConfigElement)}
          <DropShadow>
            {(item) => renderConfigElement(item, (config ?? []).length)}
          </DropShadow>
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
