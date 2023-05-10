import type { DocumentId, FolderId } from "@storyflow/shared/types";
import React from "react";
import { useCollab } from "../../collab/CollabContext";
import { DocumentAddTransactionEntry } from "../../operations/actions";

export function useNewDocuments(folderId: FolderId) {
  const [docs, setDocs] = React.useState<DocumentId[]>([]);

  const collab = useCollab();

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
      setDocs((ps) => {
        if (
          array.length !== ps.length ||
          !array.every((el, index) => ps[index] === el)
        ) {
          return array;
        }
        return ps;
      });
    });
  }, [collab]);

  return docs;
}
