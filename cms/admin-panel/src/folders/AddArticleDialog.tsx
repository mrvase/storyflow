import React from "react";
import Dialog from "../elements/Dialog";
import {
  getDefaultValuesFromTemplateAsync,
  useArticleListMutation,
} from "../articles";
import { useArticleIdGenerator } from "../id-generator";
import { useTabUrl } from "../layout/utils";
import { useSegment } from "../layout/components/SegmentContext";
import {
  computeFieldId,
  createId,
  getDocumentId,
  replaceDocumentId,
  restoreId,
} from "@storyflow/backend/ids";
import { Computation, DocumentId, FieldId } from "@storyflow/backend/types";
import { tools } from "shared/editor-tools";
import { CREATION_DATE_ID, URL_ID } from "@storyflow/backend/templates";
import { useClient } from "../client";

export function AddArticleDialog({
  isOpen,
  close,
  folder,
  template,
  parentUrl,
  type,
}: {
  isOpen: boolean;
  close: () => void;
  folder: string;
  template?: DocumentId;
  parentUrl?: { id: FieldId; value: Computation } | true;
  type: string;
}) {
  const mutateArticles = useArticleListMutation();
  const generateId = useArticleIdGenerator();
  const [, navigateTab] = useTabUrl();
  const { current } = useSegment();

  const client = useClient();

  return (
    <Dialog
      isOpen={isOpen}
      close={close}
      title={`Tilføj ${type === "a" ? "side" : "artikel"}`}
    >
      <form
        onSubmit={async (ev) => {
          ev.preventDefault();
          const data = new FormData(ev.target as HTMLFormElement);
          const id = await generateId();
          const defaultValues = template
            ? await getDefaultValuesFromTemplateAsync(template, client)
            : null;
          const compute = (defaultValues?.compute ?? []).map((block) => ({
            id: replaceDocumentId(block.id, id),
            value: block.value.map((el) =>
              tools.isImport(el, "field")
                ? {
                    ...el,
                    fref:
                      getDocumentId(block.id) === getDocumentId(el.fref)
                        ? replaceDocumentId(el.fref, id)
                        : el.fref,
                  }
                : el
            ),
          }));
          if (parentUrl) {
            compute.push({
              id: computeFieldId(id, URL_ID),
              value: [
                ["("],
                parentUrl === true
                  ? ""
                  : { id: createId(1), fref: parentUrl.id },
                "ny",
                [")", "url"],
              ],
            });
            /*
            if (typeof parentUrl === "object") {
            const flat = flattenComputation(parentUrl.value);
            compute.push()
            }
            */
          }
          mutateArticles({
            folder,
            actions: [
              {
                type: "insert",
                id,
                label: (data.get("label") as string) ?? "",
                version: Date.now(),
                values: Object.assign(defaultValues?.values ?? {}, {
                  [CREATION_DATE_ID]: [new Date()],
                }),
                compute,
              },
            ],
          });
          navigateTab(`${current}/d-${restoreId(id)}`, { navigate: true });
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
