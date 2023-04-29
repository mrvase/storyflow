import React from "react";
import { DropShadow, Sortable, useSortableItem } from "@storyflow/dnd";
import {
  createTemplateFieldId,
  getDocumentId,
  getRawFieldId,
} from "@storyflow/fields-core/ids";
import type { DocumentId, FieldId } from "@storyflow/shared/types";
import type {
  DocumentConfigItem,
  HeadingConfig,
  DBDocument,
} from "@storyflow/db-core/types";
import type { SyntaxTree } from "@storyflow/fields-core/types";
import { getTranslateDragEffect } from "../utils/dragEffects";
import { RenderField } from "../fields/RenderField";
import { useCollab, usePush } from "../collab/CollabContext";
import { GetDocument } from "./GetDocument";
import { ExtendTemplatePath } from "./TemplatePathContext";
import { TopFieldIndexProvider } from "./FieldIndexContext";
import { useClient } from "../client";
import { useDocumentIdGenerator } from "../id-generator";
import { getDefaultValuesFromTemplateAsync } from "./template-fields";
import { createDocumentTransformer } from "operations/apply";
import { splitTransformsAndRoot } from "@storyflow/fields-core/transform";
import { createTokenStream } from "operations/parse-token-stream";
import {
  DocumentSpliceOperation,
  DocumentTransactionEntry,
  FieldTransactionEntry,
} from "operations/actions_new";
import { createTransaction } from "@storyflow/collab/utils";

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
  versions?: DBDocument["versions"];
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
            Object.entries(defaultValues).forEach((entry) => {
              const [fieldId, tree] = entry as [FieldId, SyntaxTree];
              /* only care about native fields */
              if (getDocumentId(fieldId) !== owner) return;
              /*
              Continue only if it does not exist already
              (that is, if not deleted and now added without a save in between)
              */
              if (versions && getRawFieldId(fieldId) in versions) return;
              const [transforms, root] = splitTransformsAndRoot(tree);
              const transformOperations = transforms.map((transform) => {
                return { name: transform.type, value: transform.data ?? true };
              });
              const stream = createTokenStream(root);
              const streamOperation = stream.length
                ? { index: 0, insert: createTokenStream(root) }
                : undefined;
              if (transformOperations.length > 0 || streamOperation) {
                /*
                  TODO: Overvejelse: Jeg kan godt tilføje og slette og tilføje.
                  Har betydning ift. fx url, hvor default children pushes igen.
                  Skal muligvis lave en mulighed for, at splice action overskriver alt.
                  I så fald kan jeg tjekke, om den har været initialized.
                  Hvis ikke, så starter jeg den på version = 0 og pusher med det samme.
                  Da det sker sync, ved jeg, at det push registreres som om,
                  at det ikke har set andre actions endnu.

                  Men hvad sker der, når den kører gennem transform?
                  */

                collab
                  .getOrAddTimeline(owner, {
                    transform: createDocumentTransformer({}),
                  })
                  .initialize([], {})
                  .getQueue<FieldTransactionEntry>(getRawFieldId(fieldId))
                  .push(
                    createTransaction((t) =>
                      t
                        .target(fieldId)
                        .splice(streamOperation)
                        .toggle(...transformOperations)
                    )
                  );
              }
            });
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
            version={versions?.[getRawFieldId(fieldId)] ?? 0}
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
