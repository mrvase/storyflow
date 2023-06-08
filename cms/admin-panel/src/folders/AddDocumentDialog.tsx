import React from "react";
import Dialog from "../elements/Dialog";
import { createTemplateFieldId } from "@storyflow/cms/ids";
import type { FieldId, FolderId } from "@storyflow/shared/types";
import type { DBDocument, SyntaxTreeRecord } from "@storyflow/cms/types";
import { useDocumentIdGenerator } from "../id-generator";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";
import { insertRootInTransforms } from "@storyflow/cms/transform";
import { useAddDocument } from "../documents/useAddDocument";
import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";
import { getFieldRecord, getGraph } from "@storyflow/cms/graph";
import { createSlug } from "../utils/createSlug";

export function useAddDocumentDialog() {
  const [parentUrl, setParentUrl] = React.useState<{
    id: FieldId;
    record: SyntaxTreeRecord;
    url: string;
  }>();

  const addDocumentWithUrl = (parent: Pick<DBDocument, "_id" | "record">) => {
    const urlId = createTemplateFieldId(parent._id, DEFAULT_FIELDS.url.id);
    setParentUrl({
      id: urlId,
      url:
        (calculateRootFieldFromRecord(urlId, parent.record)?.[0] as string) ??
        "",
      record: getFieldRecord(parent.record, urlId, getGraph(parent.record)),
    });
  };

  const close = () => setParentUrl(undefined);

  return [parentUrl, addDocumentWithUrl, close] as [
    typeof parentUrl,
    typeof addDocumentWithUrl,
    typeof close
  ];
}

export function AddDocumentDialog({
  isOpen,
  close,
  folder,
  parentUrl,
  type,
}: {
  isOpen: boolean;
  close: () => void;
  folder: FolderId;
  parentUrl?: {
    id: FieldId;
    record: SyntaxTreeRecord;
    url: string;
  };
  type: "app" | "folder";
}) {
  const addDocument = useAddDocument({ navigate: true });

  const generateDocumentId = useDocumentIdGenerator();

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
            addDocument({
              folder,
              createRecord: (id) => ({
                [createTemplateFieldId(id, DEFAULT_FIELDS.creation_date.id)]: {
                  ...DEFAULT_SYNTAX_TREE,
                  children: [new Date()],
                },
                ...(parentUrl
                  ? {
                      ...parentUrl.record,
                      [createTemplateFieldId(id, DEFAULT_FIELDS.url.id)]:
                        insertRootInTransforms(
                          {
                            ...DEFAULT_SYNTAX_TREE,
                            children: [
                              {
                                id: generateDocumentId(id),
                                field: parentUrl.id,
                                inline: true,
                              },
                              "/",
                              slug,
                            ],
                          },
                          DEFAULT_FIELDS.url.initialValue.transforms
                        ),
                      [createTemplateFieldId(id, DEFAULT_FIELDS.label.id)]: {
                        ...DEFAULT_SYNTAX_TREE,
                        children: [label],
                      },
                    }
                  : {}),
              }),
            });
            close();
          } catch (err) {
            console.log(err);
          }
        }}
      >
        <div className="text-sm font-medium mb-1">Navn</div>
        <FocusOnEnter>
          <input
            type="text"
            name="label"
            value={label}
            onChange={(ev) => {
              const newLabel = ev.target.value;
              setLabel(newLabel);
              if (createSlug(label) === slug) {
                setSlug(createSlug(newLabel));
              }
            }}
            className="ring-button bg-transparent rounded h-10 flex items-center px-2.5 outline-none w-full"
            autoComplete="off"
          />
        </FocusOnEnter>
        <div className="text-sm font-medium mt-2 mb-1">URL</div>
        <input
          type="text"
          name="slug"
          value={slug}
          onChange={(ev) => setSlug(ev.target.value)}
          className="ring-button bg-transparent rounded h-10 flex items-center px-2.5 outline-none w-full"
          autoComplete="off"
        />
        <div className="flex flex-row-reverse mt-5 gap-2">
          <button
            type="submit"
            className="h-8 px-3 flex-center bg-white/10 hover:bg-white/20 rounded font-medium text-sm transition-colors"
          >
            Opret
          </button>
          <button
            className="h-8 px-3 flex-center bg-black/10 hover:bg-black/20 rounded font-medium text-sm transition-colors"
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

function FocusOnEnter({ children }: { children: React.ReactElement }) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return React.cloneElement(children, { ref: inputRef });
}
