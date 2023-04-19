import { DocumentId, FolderId } from "@storyflow/backend/types";
import React from "react";
import { useDocumentListMutation } from "../../documents";

export function useDeleteForm({ folderId }: { folderId: FolderId }) {
  const form = React.useRef<HTMLFormElement | null>(null);

  const mutateDocuments = useDocumentListMutation();

  const handleDelete = () => {
    if (form.current && folderId) {
      const data = new FormData(form.current);
      const ids = Array.from(data.keys()) as DocumentId[];
      if (ids.length) {
        mutateDocuments({
          folder: folderId,
          actions: ids.map((id) => ({
            type: "remove",
            id,
          })),
        });
      }
    }
  };

  return { form, handleDelete };
}
