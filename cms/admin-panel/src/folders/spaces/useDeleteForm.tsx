import type { DocumentId, FolderId } from "@storyflow/shared/types";
import React from "react";
import { usePush } from "../../collab/CollabContext";
import { createTransaction } from "@storyflow/collab/utils";
import { DocumentAddTransactionEntry } from "../../operations/actions";
import { useImmutableQuery, useMutation } from "@nanorpc/client/swr";
import { mutate, query } from "../../clients/client";
import { isError } from "@nanorpc/client";

export const useDeleteManyMutation = (folderId: string) => {
  const { revalidate } = useImmutableQuery(
    query.documents.find({
      folder: folderId,
      limit: 150,
    })
  );

  const deleteMany = useMutation(mutate.documents.deleteMany);

  return async (ids: DocumentId[]) => {
    const result = await deleteMany(ids);
    if (!isError(result)) {
      revalidate();
    }
  };
};

export function useDeleteForm({
  folderId,
  newDocuments,
}: {
  folderId: FolderId;
  newDocuments?: DocumentId[];
}) {
  const form = React.useRef<HTMLFormElement | null>(null);

  const deleteMany = useDeleteManyMutation(folderId);
  const push = usePush<DocumentAddTransactionEntry>("documents");

  const handleDelete = () => {
    if (form.current && folderId) {
      const data = new FormData(form.current);
      const ids = Array.from(data.keys()) as DocumentId[];

      const newIds = newDocuments
        ? ids.filter((id) => newDocuments.includes(id))
        : [];
      const oldIds = newDocuments
        ? ids.filter((id) => !newDocuments.includes(id))
        : ids;

      if (newIds.length) {
        push(
          createTransaction((t) => {
            t.target(folderId);
            newIds.forEach((id) => {
              t.toggle({ name: "remove", value: id });
            });
            return t;
          })
        );
      }

      if (oldIds.length) {
        deleteMany(oldIds);
      }
    }
  };

  return { form, handleDelete };
}
