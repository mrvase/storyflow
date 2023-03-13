import React from "react";
import Dialog from "../elements/Dialog";
import { useArticleList, useArticleListMutation } from "../documents";
import { useArticleIdGenerator } from "../id-generator";
import { useFolderCollab } from "./collab/FolderCollabContext";
import { targetTools } from "shared/operations";
import { useTabUrl } from "../layout/utils";
import { useSegment } from "../layout/components/SegmentContext";
import { restoreId } from "@storyflow/backend/ids";
import { DialogOption } from "../elements/DialogOption";
import { DocumentDuplicateIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useTemplateFolder } from "./folders-context";

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
  const generateId = useArticleIdGenerator();
  const [, navigateTab] = useTabUrl();
  const { current } = useSegment();

  const collab = useFolderCollab();

  const templateFolder = useTemplateFolder()?.id;

  const onSubmit = React.useCallback(
    async (type: string, data: FormData) => {
      const label = (data.get("value") as string) ?? "";
      console.log("LABEL", label, type);
      if (!label) return;
      const id = type === "new" ? await generateId() : label;
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
              compute: [],
              values: {},
            },
          ],
        });
        navigateTab(`${current}/t-${restoreId(id)}`, { navigate: true });
      }
      close();
    },
    [collab, folderId, generateId, mutateArticles, templateFolder, close]
  );

  const { articles: templates } = useArticleList(templateFolder);

  const templateOptions = (templates ?? []).map((el) => ({
    value: el.id,
    label: el.label ?? el.id,
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
