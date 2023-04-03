import React from "react";
import Dialog from "../elements/Dialog";
import {
  useOptimisticDocumentList,
  useArticleListMutation,
} from "../documents";
import { useFolderCollab } from "./collab/FolderCollabContext";
import { targetTools } from "shared/operations";
import { DialogOption } from "../elements/DialogOption";
import { DocumentDuplicateIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useTemplateFolder } from "./FoldersContext";
import { useTemplateIdGenerator } from "../id-generator";
import { DocumentId } from "@storyflow/backend/types";
import { usePanel, useRoute } from "../panel-router/Routes";

export function AddTemplateDialog({
  isOpen,
  close,
  folderId,
  currentTemplate,
}: {
  isOpen: boolean;
  close: () => void;
  folderId: string;
  currentTemplate?: string;
}) {
  const mutateArticles = useArticleListMutation();
  const generateTemplateId = useTemplateIdGenerator();
  const [, navigate] = usePanel();
  const route = useRoute();

  const collab = useFolderCollab();

  const templateFolder = useTemplateFolder()?._id;

  const onSubmit = React.useCallback(
    async (type: string, data: FormData) => {
      const label = (data.get("value") as string) ?? "";
      if (!label) return;
      const id = type === "new" ? generateTemplateId() : (label as DocumentId);
      collab.mutate("folders", folderId).push({
        target: targetTools.stringify({
          operation: "property",
          location: "",
        }),
        ops: [
          {
            name: "template",
            value: id,
          },
        ],
      });
      if (type === "new") {
        mutateArticles({
          folder: templateFolder,
          actions: [
            {
              type: "insert",
              id,
              label,
              record: {},
            },
          ],
        });
        navigate(`${route}/t${id}`, { navigate: true });
      }
      close();
    },
    [
      collab,
      folderId,
      generateTemplateId,
      mutateArticles,
      templateFolder,
      close,
    ]
  );

  const { articles: templates } = useOptimisticDocumentList(templateFolder);

  const templateOptions = (templates ?? []).map((el) => ({
    value: el._id,
    label: el.label ?? el._id,
  }));

  return (
    <Dialog isOpen={isOpen} close={close} title="Angiv skabelon">
      <div className="flex flex-col gap-2">
        <DialogOption
          type="existing"
          icon={DocumentDuplicateIcon}
          label="Vælg eksisterende"
          input={{
            options: templateOptions,
            label: "Skabeloner",
            button: "Accepter",
            defaultValue: currentTemplate,
          }}
          onSubmit={onSubmit}
        />
        <DialogOption
          type="new"
          icon={PlusIcon}
          label="Tilføj ny"
          onSubmit={onSubmit}
          defaultChecked
        />
      </div>
    </Dialog>
  );
}
