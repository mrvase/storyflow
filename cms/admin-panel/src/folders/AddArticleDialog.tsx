import React from "react";
import Dialog from "../elements/Dialog";
import { useArticleListMutation } from "../documents";
import { getDefaultValuesFromTemplateAsync } from "../documents/template-fields";
import { createTemplateFieldId } from "@storyflow/backend/ids";
import {
  DocumentId,
  FieldId,
  FolderId,
  SyntaxTreeRecord,
} from "@storyflow/backend/types";
import { useClient } from "../client";
import { toSlug } from "../fields/UrlField";
import { useDocumentIdGenerator } from "../id-generator";
import { DEFAULT_FIELDS } from "@storyflow/backend/fields";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";
import { getConfig, insertRootInTransform } from "shared/initialValues";
import { usePanel, useRoute } from "../panel-router/Routes";

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
    record: SyntaxTreeRecord;
    url: string;
  };
  type: "app" | "folder";
}) {
  const mutateArticles = useArticleListMutation();
  const generateDocumentId = useDocumentIdGenerator();
  const [, navigate] = usePanel();
  const route = useRoute();
  const client = useClient();

  const [label, setLabel] = React.useState("");
  const [slug, setSlug] = React.useState("");

  return (
    <Dialog
      isOpen={isOpen}
      close={close}
      title={`Tilføj ${type === "app" ? "side" : "artikel"}`}
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

            record[createTemplateFieldId(id, DEFAULT_FIELDS.creation_date.id)] =
              {
                ...DEFAULT_SYNTAX_TREE,
                children: [new Date()],
              };

            if (parentUrl) {
              Object.assign(record, parentUrl.record);

              record[createTemplateFieldId(id, DEFAULT_FIELDS.url.id)] =
                insertRootInTransform(
                  {
                    ...DEFAULT_SYNTAX_TREE,
                    children: [
                      {
                        id: generateDocumentId(id),
                        field: parentUrl.id,
                        inline: true,
                      },
                      slug,
                    ],
                  },
                  getConfig("url").transform!
                );

              record[createTemplateFieldId(id, DEFAULT_FIELDS.label.id)] = {
                ...DEFAULT_SYNTAX_TREE,
                children: [label],
              };
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
            navigate(`${route}/d${id}`, { navigate: true });
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
