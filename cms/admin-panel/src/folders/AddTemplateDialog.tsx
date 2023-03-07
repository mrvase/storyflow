import React from "react";
import Dialog from "../elements/Dialog";
import { useArticleListMutation } from "../articles";
import { useArticleIdGenerator } from "../id-generator";
import { useFolderCollab } from "../state/collab-folder";
import { targetTools } from "shared/operations";
import { useTabUrl } from "../layout/utils";
import { useSegment } from "../layout/components/SegmentContext";
import { restoreId } from "@storyflow/backend/ids";

export function AddTemplateDialog({
  isOpen,
  close,
  folderId,
  templateFolder,
}: {
  isOpen: boolean;
  close: () => void;
  folderId: string;
  templateFolder: string;
}) {
  const mutateArticles = useArticleListMutation();
  const generateId = useArticleIdGenerator();
  const [, navigateTab] = useTabUrl();
  const { current } = useSegment();

  const collab = useFolderCollab();

  return (
    <Dialog isOpen={isOpen} close={close} title="Tilføj skabelon">
      <form
        onSubmit={async (ev) => {
          ev.preventDefault();
          const data = new FormData(ev.target as HTMLFormElement);
          const label = (data.get("label") as string) ?? "";
          const id = await generateId();
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
          navigateTab(`${current}/t-${restoreId(id)}`, { navigate: true });
          close();
        }}
      >
        <div className="text-sm font-normal mb-1">Navn</div>
        <input
          type="text"
          name="label"
          className="bg-white/5 rounded py-2 px-2.5 outline-none w-full"
        />
        <div className="flex flex-row-reverse mt-5 gap-2">
          <button
            type="submit"
            className="h-8 px-3 flex-center bg-white/10 hover:bg-white/20 rounded font-normal text-sm transition-colors"
          >
            Opret
          </button>
          <button
            className="h-8 px-3 flex-center bg-black/10 hover:bg-black/20 rounded font-normal text-sm transition-colors"
            onClick={(ev) => {
              ev.preventDefault();
              close();
            }}
          >
            Annuller
          </button>
        </div>
      </form>
    </Dialog>
  );
}
