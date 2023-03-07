import React from "react";
import { useArticleListMutation } from "../../articles";

export function useDeleteForm({ folderId }: { folderId: string }) {
  const form = React.useRef<HTMLFormElement | null>(null);

  const mutateArticles = useArticleListMutation();

  const handleDelete = () => {
    if (form.current && folderId) {
      const data = new FormData(form.current);
      const ids = Array.from(data.keys());
      if (ids.length) {
        mutateArticles({
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
