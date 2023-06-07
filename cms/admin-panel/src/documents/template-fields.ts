import type {
  DocumentId,
  FieldId,
  NestedDocumentId,
  RawDocumentId,
} from "@storyflow/shared/types";
import type {
  SyntaxTreeRecord,
  FieldConfig,
  SyntaxTree,
} from "@storyflow/cms/types";
import type { DocumentConfig } from "@storyflow/cms/types";
import {
  createRawTemplateFieldId,
  createTemplateFieldId,
  getDocumentId,
  getIdFromString,
  getRawDocumentId,
  getRawFieldId,
  isNestedDocumentId,
  replaceDocumentId,
} from "@storyflow/cms/ids";
import { fetchDocument } from "./index";
import { isSyntaxTree, getSyntaxTreeEntries } from "@storyflow/cms/syntax-tree";
import { tokens } from "@storyflow/cms/tokens";
import { splitTransformsAndRoot } from "@storyflow/cms/transform";
import { Timeline } from "@storyflow/collab/Timeline";
import { createTransaction } from "@storyflow/collab/utils";
import { FieldTransactionEntry } from "../operations/actions";
import { createTokenStream } from "../operations/parse-token-stream";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";

export const copyRecord = (
  originalRecord: SyntaxTreeRecord,
  options: {
    oldDocumentId: DocumentId;
    newDocumentId: DocumentId;
    generateNestedDocumentId: () => NestedDocumentId;
    generateTemplateFieldId?: (key: FieldId) => FieldId;
  }
) => {
  const newNestedIds = new Map<RawDocumentId, NestedDocumentId>();

  const getNewNestedId = (oldRaw: RawDocumentId) => {
    const existing = newNestedIds.get(oldRaw);
    if (existing) return existing;
    const newId = options.generateNestedDocumentId();
    newNestedIds.set(oldRaw, newId);
    return newId;
  };

  const getNewKey = (key: FieldId) => {
    if (getDocumentId(key) !== options.oldDocumentId) return key;
    return options.generateTemplateFieldId!(key);
  };

  let record: SyntaxTreeRecord = {};

  const modifyNode = (node: SyntaxTree): SyntaxTree => {
    return {
      ...node,
      children: node.children.map((token) => {
        if (isSyntaxTree(token)) {
          const newToken = { ...token };
          if (newToken.type === "loop") {
            newToken.data = getRawDocumentId(getNewNestedId(token.data!));
          }
          return modifyNode(newToken);
        } else if (
          tokens.isNestedEntity(token) &&
          isNestedDocumentId(token.id)
        ) {
          const newNestedId = getNewNestedId(getRawDocumentId(token.id));
          const newToken = { ...token };
          newToken.id = newNestedId;

          // replace references to the old template fields with references to the new ones
          if (
            options.generateTemplateFieldId &&
            "field" in newToken &&
            getDocumentId(newToken.field) === options.oldDocumentId
          ) {
            newToken.field = getNewKey(newToken.field);
          } else if (
            "field" in newToken &&
            newToken.field.endsWith(getIdFromString("data"))
          ) {
            newToken.field = replaceDocumentId(
              newToken.field,
              getNewNestedId(getRawDocumentId(getDocumentId(newToken.field)))
            );
          }

          return newToken;
        }
        return token;
      }),
    };
  };

  const exludeFields = new Set(
    [DEFAULT_FIELDS.creation_date.id, DEFAULT_FIELDS.template_label.id].map(
      createRawTemplateFieldId
    )
  );

  getSyntaxTreeEntries(originalRecord).forEach(([key, value]) => {
    // fix template field ids
    let newKey = key;

    if (exludeFields.has(getRawFieldId(key))) {
      console.log("EXCLUDING FIELD!!", key, value);
      return;
    }

    if (
      options.generateTemplateFieldId &&
      getDocumentId(key) === options.oldDocumentId
    ) {
      newKey = getNewKey(key);
    }

    record[newKey] = modifyNode(value);
  });

  // fix nested record keys
  record = Object.fromEntries(
    getSyntaxTreeEntries(record).map(([key, value]) => {
      const parentId = getDocumentId(key);
      const raw = getRawDocumentId(parentId);
      let newKey = key;

      if (newNestedIds.has(raw)) {
        newKey = replaceDocumentId(key, newNestedIds.get(raw)!);
      }

      return [newKey, value];
    })
  );
  return record;
};

export const getDefaultValuesFromTemplateAsync = async (
  newDocumentId: DocumentId,
  templateId: DocumentId,
  options: {
    generateDocumentId: {
      (): DocumentId;
      (parent: DocumentId): NestedDocumentId;
    };
  }
) => {
  const doc = await fetchDocument(templateId);

  if (doc) {
    return copyRecord(doc.record, {
      oldDocumentId: doc._id,
      newDocumentId,
      generateNestedDocumentId: () => options.generateDocumentId(newDocumentId),
      generateTemplateFieldId: (key) =>
        createTemplateFieldId(newDocumentId, key),
    });
  }

  return {};
};

export const getTemplateFieldsAsync = async (template: DocumentConfig) => {
  const templates = new Set();

  const getFields = async (
    template: DocumentConfig
  ): Promise<FieldConfig[]> => {
    return await Promise.all(
      template.map(async (el) => {
        if (Array.isArray(el)) {
          return el;
        } else if ("id" in el) {
          return [el];
        } else if ("template" in el && !templates.has(el.template)) {
          templates.add(el.template);
          const doc = await fetchDocument(el.template);
          if (!doc) return [];
          return await getFields(doc.config);
        }
        return [];
      })
    ).then((el) => el.flat(1));
  };

  return await getFields(template);
};

export const pushDefaultValues = (
  timeline: Timeline,
  data: {
    id: DocumentId;
    record: SyntaxTreeRecord;
  }
) => {
  Object.entries(data.record).forEach((entry) => {
    const [fieldId, tree] = entry as [FieldId, SyntaxTree];
    /* only care about native fields */
    if (getDocumentId(fieldId) !== data.id) return;
    /*
    Continue only if it does not exist already
    (that is, if not deleted and now added without a save in between)
    */
    // if (versions && getRawFieldId(fieldId) in versions) return;
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

      timeline.getQueue<FieldTransactionEntry>(getRawFieldId(fieldId)).push(
        createTransaction((t) =>
          t
            .target(fieldId)
            .toggle(...transformOperations)
            .splice(streamOperation)
        )
      );
    }
  });
};
