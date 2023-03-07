import React from "react";
import Dialog from "../elements/Dialog";
import { useArticleIdGenerator, useFolderIdGenerator } from "../id-generator";
import { DocumentId } from "@storyflow/backend/types";
import { useFolderCollab } from "../state/collab-folder";
import { targetTools } from "shared/operations";
import { useArticleListMutation } from "../articles";
import { computeFieldId } from "@storyflow/backend/ids";
import { LABEL_ID, URL_ID } from "@storyflow/backend/templates";
import {
  CheckIcon,
  ComputerDesktopIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import { DialogOption } from "../elements/DialogOption";

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
  const generateId = useFolderIdGenerator();
  const generateFrontId = useArticleIdGenerator();

  const collab = useFolderCollab();

  const onSubmit = React.useCallback(
    async (type: string, data: FormData) => {
      const label = (data.get("value") as string) ?? "";
      if (!label) return;
      const [id, frontId] = await Promise.all([
        generateId(),
        type === "app" ? generateFrontId() : ("" as DocumentId),
      ]);
      const folder = {
        id,
        label,
        type,
        children: [],
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
              compute: [
                {
                  id: computeFieldId(frontId, URL_ID),
                  value: [{ "(": true }, "", "", { ")": "url" }],
                },
                {
                  id: computeFieldId(frontId, LABEL_ID),
                  value: ["Forside"],
                },
              ],
              values: {
                [URL_ID]: [""],
                [LABEL_ID]: ["Forside"],
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
      generateId,
      generateFrontId,
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
