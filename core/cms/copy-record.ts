import {
  DocumentId,
  NestedDocumentId,
  FieldId,
  RawDocumentId,
} from "@storyflow/shared/types";
import { DEFAULT_FIELDS } from "./default-fields";
import {
  getDocumentId,
  getRawDocumentId,
  isNestedDocumentId,
  getIdFromString,
  replaceDocumentId,
  createRawTemplateFieldId,
  getRawFieldId,
} from "./ids";
import { isSyntaxTree, getSyntaxTreeEntries } from "./syntax-tree";
import { tokens } from "./tokens";
import { SyntaxTreeRecord, SyntaxTree } from "./types";

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
