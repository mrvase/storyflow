import type { DocumentId, FieldId, FolderId } from "@storyflow/shared/types";
import React from "react";
import { useCollab } from "../../collab/CollabContext";
import { DocumentAddTransactionEntry } from "../../operations/actions";
import { getUpdatedFieldValue } from "../../documents/getUpdatedFieldValue";
import { createTemplateFieldId } from "@storyflow/cms/ids";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { DBDocument, SyntaxTree } from "@storyflow/cms/types";
import { calculateField } from "@storyflow/cms/calculate-server";
import { readFromCache, useClient } from "../../RPCProvider";

export function useNewDocuments(
  folderId: FolderId,
  options: { externalDocuments?: any[]; includeUrl?: boolean } = {}
) {
  const [docs, setDocs] = React.useState<
    { id: DocumentId; label: SyntaxTree; url: SyntaxTree | undefined }[]
  >([]);

  const collab = useCollab();
  const client = useClient();

  const handleDocs = React.useCallback(
    async (ids: DocumentId[]) => {
      const newIds = ids.filter(
        (el) => !docs.some((existing) => existing.id === el)
      );

      const getUpdatedTree = async (id: DocumentId, defaulFieldId: FieldId) => {
        const doc: Pick<DBDocument, "_id" | "versions" | "config" | "record"> =
          {
            _id: id,
            config: [],
            versions: { config: [0] },
            record: {},
          };

        const { tree } = await getUpdatedFieldValue(
          createTemplateFieldId(id, defaulFieldId),
          doc,
          collab
        );

        return tree;
      };

      const newDocs = await Promise.all(
        newIds.map(async (id) => ({
          id,
          label: await getUpdatedTree(id, DEFAULT_FIELDS.label.id),
          url: options.includeUrl
            ? await getUpdatedTree(id, DEFAULT_FIELDS.url.id)
            : undefined,
        }))
      );

      const newState = docs.filter((el) => ids.includes(el.id));
      newState.push(...newDocs);

      if (newIds.length > 0 || newState.length < docs.length) {
        setDocs(newState);
      }
    },
    [docs, collab, client]
  );

  const calculatedDocs = React.useMemo(() => {
    const getCalculatedFieldValue = (tree: SyntaxTree) => {
      const getRecord = (id: DocumentId) => {
        const key = client.documents.findById.key(id);
        const exists = readFromCache(key);
        return exists?.record ?? {};
      };

      const result = calculateField(tree, getRecord);

      if (Array.isArray(result) && typeof result[0] === "string") {
        return result[0];
      }

      return "";
    };

    return docs.map((doc) => ({
      ...doc,
      label: getCalculatedFieldValue(doc.label),
      url: options.includeUrl ? getCalculatedFieldValue(doc.url!) : undefined,
    }));
  }, [docs, options.externalDocuments]);

  React.useEffect(() => {
    const queue = collab
      .getTimeline("documents")!
      .getQueue<DocumentAddTransactionEntry>();
    return queue.register(() => {
      const docs = new Set<DocumentId>();
      queue.forEach(({ transaction }) => {
        transaction.forEach((entry) => {
          if (entry[0] === folderId) {
            entry[1].forEach((operation) => {
              if (operation[0] === "add") {
                docs.add(operation[1]);
              } else if (operation[0] === "remove") {
                docs.delete(operation[1]);
              }
            });
          }
        });
      });
      const array = Array.from(docs).reverse();
      handleDocs(array);
    });
  }, [collab, handleDocs]);

  return calculatedDocs;
}
