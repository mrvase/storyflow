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

export const copyRecord = async (
  originalRecord: SyntaxTreeRecord,
  options: {
    oldDocumentId: DocumentId;
    newDocumentId: DocumentId;
    generateNestedDocumentId: () => Promise<NestedDocumentId>;
    generateTemplateFieldId?: (key: FieldId) => FieldId;
    excludeSpecialTemplateFields?: boolean;
  }
) => {
  const newNestedIds = new Map<RawDocumentId, NestedDocumentId>();

  const getNewNestedId = async (oldRaw: RawDocumentId) => {
    const existing = newNestedIds.get(oldRaw);
    if (existing) return existing;
    const newId = await options.generateNestedDocumentId();
    newNestedIds.set(oldRaw, newId);
    return newId;
  };

  const getNewKey = (key: FieldId) => {
    if (getDocumentId(key) !== options.oldDocumentId) return key;
    return options.generateTemplateFieldId!(key);
  };

  const modifyNode = async (node: SyntaxTree): Promise<SyntaxTree> => {
    const children = await Promise.all(
      node.children.map(async (token) => {
        if (isSyntaxTree(token)) {
          const newToken = { ...token };
          if (newToken.type === "loop") {
            const id = await getNewNestedId(token.data!);
            newToken.data = getRawDocumentId(id);
          }
          return modifyNode(newToken);
        } else if (
          tokens.isNestedEntity(token) &&
          isNestedDocumentId(token.id)
        ) {
          const newNestedId = await getNewNestedId(getRawDocumentId(token.id));
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
            const id = await getNewNestedId(
              getRawDocumentId(getDocumentId(newToken.field))
            );
            newToken.field = replaceDocumentId(newToken.field, id);
          }

          return newToken;
        }
        return token;
      })
    );

    return {
      ...node,
      children,
    };
  };

  const exludeFields = options.excludeSpecialTemplateFields
    ? new Set(
        [DEFAULT_FIELDS.creation_date.id, DEFAULT_FIELDS.template_label.id].map(
          createRawTemplateFieldId
        )
      )
    : new Set();

  let entries = await Promise.all(
    getSyntaxTreeEntries(originalRecord).map(
      async ([key, value]): Promise<[FieldId, SyntaxTree] | undefined> => {
        // fix template field ids
        let newKey = key;

        if (exludeFields.has(getRawFieldId(key))) {
          return undefined;
        }

        if (
          options.generateTemplateFieldId &&
          getDocumentId(key) === options.oldDocumentId
        ) {
          newKey = getNewKey(key);
        }

        return [newKey, await modifyNode(value)];
      }
    )
  );

  // fix nested record keys
  const record: SyntaxTreeRecord = Object.fromEntries(
    entries
      .filter((el): el is Exclude<typeof el, undefined> => el !== undefined)
      .map(([key, value]) => {
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
