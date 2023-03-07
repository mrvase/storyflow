import React from "react";
import Dialog from "../elements/Dialog";
import { useArticleIdGenerator, useFolderIdGenerator } from "../id-generator";
import { DocumentId } from "@storyflow/backend/types";
import { useFolderCollab } from "../state/collab-folder";
import { targetTools } from "shared/operations";
import { useArticleListMutation } from "../articles";
import { computeFieldId } from "@storyflow/backend/ids";
import { LABEL_ID, URL_ID } from "@storyflow/backend/templates";

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

  return (
    <Dialog isOpen={isOpen} close={close} title="Tilføj mappe">
      <form
        onSubmit={async (ev) => {
          ev.preventDefault();
          const data = new FormData(ev.target as HTMLFormElement);
          const type = (data.get("type") as "data" | "app") ?? "data";
          const label = (data.get("label") as string) ?? "";
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
        }}
      >
        <div className="flex flex-col gap-2 mb-4">
          <div className="text-sm font-normal mb-1">Navn</div>
          <input
            type="text"
            name="label"
            className="bg-white/5 rounded py-2 px-2.5 outline-none w-full"
            autoComplete="off"
          />
          <label className="relative z-0 block p-5 w-full">
            <input
              type="radio"
              name="type"
              value="data"
              defaultChecked
              className="peer w-0 h-0"
            />{" "}
            <div className="absolute peer-focus:ring-2 ring-yellow-300 inset-0 -z-10 bg-white/5 peer-checked:bg-white/20 transition-colors duration-75 rounded"></div>
            Mappe
          </label>
          <label className="relative z-0 block p-5 w-full">
            <input
              type="radio"
              name="type"
              value="app"
              className="peer w-0 h-0"
            />{" "}
            <div className="absolute peer-focus:ring-2 ring-yellow-300 inset-0 -z-10 bg-white/5 peer-checked:bg-white/20 transition-colors duration-75 rounded"></div>
            App
          </label>
        </div>
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
