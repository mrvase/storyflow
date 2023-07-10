import React from "react";
import Dialog from "../elements/Dialog";
import type { SpaceId } from "@storyflow/cms/types";
import type { FolderId } from "@storyflow/shared/types";
import { createTemplateFieldId } from "@storyflow/cms/ids";
import { ComputerDesktopIcon, FolderIcon } from "@heroicons/react/24/outline";
import { DialogOption } from "../elements/DialogOption";
import { useDocumentIdGenerator, useFolderIdGenerator } from "../id-generator";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";
import { insertRootInTransforms } from "@storyflow/cms/transform";
import { usePush } from "../collab/CollabContext";
import { createTransaction } from "@storyflow/collab/utils";
import {
  FolderTransactionEntry,
  SpaceTransactionEntry,
} from "../operations/actions";
import { useAddDocument } from "../documents/useAddDocument";
import { useTranslation } from "../translation/TranslationContext";
import { useFolders } from "./FoldersContext";

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
  const t = useTranslation();

  const generateFolderId = useFolderIdGenerator();
  const generateDocumentId = useDocumentIdGenerator();

  const addDocument = useAddDocument();

  const push = usePush<FolderTransactionEntry | SpaceTransactionEntry>(
    "folders"
  );

  const onSubmit = React.useCallback(
    async (type: string, data: FormData) => {
      if (type === "existing") {
        const id = data.get("value") as FolderId;
        push(
          createTransaction((t) =>
            t.target(`${folderId}:${spaceId}`).splice({
              index: 0,
              insert: [id],
            })
          )
        );
        return;
      }

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
          folderId: newFolderId,
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

  const folderOptions = Array.from(useFolders().values()).map((el) => ({
    value: el._id,
    label: el.label,
  }));

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
        <DialogOption
          icon={FolderIcon}
          type="existing"
          label="Eksisterende mappe"
          input={{
            options: folderOptions,
            label: "Mapper",
            button: t.general.accept(),
          }}
          onSubmit={onSubmit}
        />
      </div>
    </Dialog>
  );
}
