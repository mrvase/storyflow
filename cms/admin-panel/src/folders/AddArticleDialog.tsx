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
import {
  Computation,
  ComputationBlock,
  DocumentId,
  FieldId,
  FlatComputation,
} from "@storyflow/backend/types";
import { tools } from "shared/editor-tools";
import {
  CREATION_DATE_ID,
  LABEL_ID,
  URL_ID,
} from "@storyflow/backend/templates";
import { useClient } from "../client";
import { extendPath } from "@storyflow/backend/extendPath";
import { toSlug } from "../fields/UrlField";

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
  parentUrl?: {
    id: FieldId;
    value: FlatComputation;
    url: string;
    imports: ComputationBlock[];
  };
  type: string;
}) {
  const mutateArticles = useArticleListMutation();
  const generateId = useArticleIdGenerator();
  const [, navigateTab] = useTabUrl();
  const { current } = useSegment();
  const client = useClient();

  const [label, setLabel] = React.useState("");
  const [slug, setSlug] = React.useState("");

  return (
    <Dialog
      isOpen={isOpen}
      close={close}
      title={`Tilføj ${type === "a" ? "side" : "artikel"}`}
    >
      <form
        onSubmit={async (ev) => {
          try {
            ev.preventDefault();
            const id = await generateId();
            const defaultValues = template
              ? await getDefaultValuesFromTemplateAsync(template, client)
              : null;
            const compute = (defaultValues?.compute ?? []).map((block) => ({
              id: replaceDocumentId(block.id, id),
              value: block.value.map((el) =>
                tools.isFieldImport(el)
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
            const values = Object.assign(defaultValues?.values ?? {}, {
              [CREATION_DATE_ID]: [new Date()],
            });
            if (parentUrl) {
              compute.push(...parentUrl.imports);

              compute.push({
                id: parentUrl.id,
                value: parentUrl.value,
              });

              compute.push({
                id: computeFieldId(id, URL_ID),
                value: [
                  { "(": true },
                  { id: createId(1), fref: parentUrl.id },
                  slug,
                  { ")": "url" },
                ],
              });

              values[URL_ID] = [extendPath(parentUrl.url, slug, "/")];
              values[LABEL_ID] = [label];
            }
            mutateArticles({
              folder,
              actions: [
                {
                  type: "insert",
                  id,
                  values,
                  compute,
                },
              ],
            });
            navigateTab(`${current}/d-${restoreId(id)}`, { navigate: true });
            close();
          } catch (err) {
            console.log(err);
          }
        }}
      >
        <div className="text-sm font-normal mb-1">Navn</div>
        <input
          type="text"
          name="label"
          value={label}
          onChange={(ev) => {
            const newLabel = ev.target.value;
            setLabel(newLabel);
            if (toSlug(label) === slug) {
              setSlug(toSlug(newLabel));
            }
          }}
          className="bg-white/5 rounded py-2 px-2.5 outline-none w-full font-light"
          autoComplete="off"
        />
        <div className="text-sm font-normal mt-2 mb-1">URL</div>
        <input
          type="text"
          name="slug"
          value={slug}
          onChange={(ev) => setSlug(ev.target.value)}
          className="bg-white/5 rounded py-2 px-2.5 outline-none w-full font-light"
          autoComplete="off"
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
