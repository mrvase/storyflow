import React from "react";
import Dialog from "../elements/Dialog";
import type { SpaceId } from "@storyflow/db-core/types";
import type { FolderId } from "@storyflow/shared/types";
import { createTemplateFieldId } from "@storyflow/fields-core/ids";
import { ComputerDesktopIcon, FolderIcon } from "@heroicons/react/24/outline";
import { DialogOption } from "../elements/DialogOption";
import { useDocumentIdGenerator, useFolderIdGenerator } from "../id-generator";
import { DEFAULT_FIELDS } from "@storyflow/fields-core/default-fields";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/fields-core/constants";
import { insertRootInTransforms } from "@storyflow/fields-core/transform";
import { usePush } from "../collab/CollabContext";
import { createTransaction } from "@storyflow/collab/utils";
import {
  FolderTransactionEntry,
  SpaceTransactionEntry,
} from "operations/actions";
import { useAddDocument } from "../documents/useAddDocument";

export function AddFolderDialog({
  isOpen,
  close,
  folderId,
  spaceId,
}: {
  isOpen: boolean;
  close: () => void;
  folderId: FolderId;
  spaceId: SpaceId;
}) {
  const generateFolderId = useFolderIdGenerator();
  const generateDocumentId = useDocumentIdGenerator();

  const addDocument = useAddDocument();

  const push = usePush<FolderTransactionEntry | SpaceTransactionEntry>(
    "folders"
  );

  const onSubmit = React.useCallback(
    async (type: string, data: FormData) => {
      const label = (data.get("value") as string) ?? "";
      if (!label) return;
      const newFolderId = generateFolderId();
      /*
      const folder: DBFolder = {
        _id: folderId,
        label,
        type: type as "app" | "data",
        spaces: [],
      };
      */
      push(
        createTransaction((t) =>
          t
            .target(`${folderId}:${spaceId}`)
            .splice({
              index: 0,
              insert: [newFolderId],
            })
            .target(newFolderId)
            .toggle({ name: "label", value: label })
        )
      );
      if (type === "app") {
        addDocument({
          folder: newFolderId,
          createRecord: (id) => ({
            [createTemplateFieldId(id, DEFAULT_FIELDS.label.id)]: {
              ...DEFAULT_SYNTAX_TREE,
              children: ["Forside"],
            },
            [createTemplateFieldId(id, DEFAULT_FIELDS.url.id)]:
              insertRootInTransforms(
                {
                  ...DEFAULT_SYNTAX_TREE,
                  children: DEFAULT_FIELDS.url.initialValue.children,
                },
                DEFAULT_FIELDS.url.initialValue.transforms
              ),
          }),
        });
      }
      close();
    },
    [
      push,
      folderId,
      spaceId,
      generateDocumentId,
      generateFolderId,
      addDocument,
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
