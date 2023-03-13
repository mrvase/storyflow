import React from "react";
import Dialog from "../elements/Dialog";
import { DocumentId } from "@storyflow/backend/types";
import { useFolderCollab } from "./collab/FolderCollabContext";
import { targetTools } from "shared/operations";
import { useArticleListMutation } from "../documents";
import { computeFieldId } from "@storyflow/backend/ids";
import { ComputerDesktopIcon, FolderIcon } from "@heroicons/react/24/outline";
import { DialogOption } from "../elements/DialogOption";
import { useDocumentIdGenerator, useFolderIdGenerator } from "../id-generator";
import { FIELDS } from "@storyflow/backend";

export function AddFolderDialog({
  isOpen,
  close,
  folderId,
  spaceId,
}: {
  isOpen: boolean;
  close: () => void;
  folderId: string;
  spaceId: string;
}) {
  const mutateArticles = useArticleListMutation();
  const generateFolderId = useFolderIdGenerator();
  const generateDocumentId = useDocumentIdGenerator();

  const collab = useFolderCollab();

  const onSubmit = React.useCallback(
    async (type: string, data: FormData) => {
      const label = (data.get("value") as string) ?? "";
      if (!label) return;
      const [id, frontId] = await Promise.all([
        generateFolderId(),
        type === "app" ? generateDocumentId() : ("" as DocumentId),
      ]);
      const folder = {
        id,
        label,
        type,
      };
      collab.mutate("folders", "").push({
        target: targetTools.stringify({
          operation: "add-folder",
          location: "",
        }),
        ops: [folder],
      });
      collab.mutate("folders", `${folderId}/${spaceId}`).push({
        target: targetTools.stringify({
          operation: "space-items",
          location: "",
        }),
        ops: [
          {
            index: 0,
            insert: [id],
          },
        ],
      });
      if (frontId) {
        mutateArticles({
          folder: id,
          actions: [
            {
              type: "insert",
              id: frontId,
              record: {
                [computeFieldId(frontId, FIELDS.url.id)]: [""],
                [computeFieldId(frontId, FIELDS.label.id)]: ["Forside"],
                [computeFieldId(frontId, FIELDS.url.id)]: [
                  { "(": true },
                  "",
                  "",
                  { ")": "url" },
                ],
              },
            },
          ],
        });
      }
      close();
    },
    [
      collab,
      folderId,
      spaceId,
      generateDocumentId,
      generateFolderId,
      mutateArticles,
      close,
    ]
  );

  return (
    <Dialog isOpen={isOpen} close={close} title="Tilføj mappe">
      <div className="flex flex-col gap-2">
        <DialogOption
          icon={FolderIcon}
          type="data"
          label="Mappe"
          defaultChecked
          onSubmit={onSubmit}
        />
        <DialogOption
          icon={ComputerDesktopIcon}
          type="app"
          label="App"
          onSubmit={onSubmit}
        />
      </div>
    </Dialog>
  );
}
