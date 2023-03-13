import React from "react";
import Dialog from "../elements/Dialog";
import { useArticleListMutation } from "../documents";
import { getDefaultValuesFromTemplateAsync } from "../documents/template-fields";
import { useTabUrl } from "../layout/utils";
import { useSegment } from "../layout/components/SegmentContext";
import { computeFieldId } from "@storyflow/backend/ids";
import {
  ComputationRecord,
  DocumentId,
  FieldId,
  FolderId,
} from "@storyflow/backend/types";
import { useClient } from "../client";
import { toSlug } from "../fields/UrlField";
import { useDocumentIdGenerator, useFieldIdGenerator } from "../id-generator";
import { FIELDS } from "@storyflow/backend";

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
  folder: FolderId;
  template?: DocumentId;
  parentUrl?: {
    id: FieldId;
    record: ComputationRecord;
    url: string;
  };
  type: string;
}) {
  const mutateArticles = useArticleListMutation();
  const generateDocumentId = useDocumentIdGenerator();
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
            const id = generateDocumentId();
            const record = template
              ? await getDefaultValuesFromTemplateAsync(id, template, {
                  client,
                  generateDocumentId,
                })
              : {};

            record[computeFieldId(id, FIELDS.creation_date.id)] = [new Date()];

            if (parentUrl) {
              Object.assign(record, parentUrl.record);

              record[computeFieldId(id, FIELDS.url.id)] = [
                { "(": true },
                { id: generateDocumentId(id), field: parentUrl.id },
                slug,
                { ")": "url" },
              ];

              record[computeFieldId(id, FIELDS.label.id)] = [label];
            }

            mutateArticles({
              folder,
              actions: [
                {
                  type: "insert",
                  id,
                  record,
                },
              ],
            });
            navigateTab(`${current}/d-${id}`, { navigate: true });
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
