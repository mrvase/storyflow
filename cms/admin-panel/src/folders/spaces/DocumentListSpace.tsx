import cl from "clsx";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { createTemplateFieldId } from "@storyflow/fields-core/ids";
import type { DocumentId, FolderId } from "@storyflow/shared/types";
import type { SpaceId } from "@storyflow/db-core/types";
import React from "react";
import { fetchDocument, useDocumentList } from "../../documents";
import { useAddDocument } from "../../documents/useAddDocument";
import { getDocumentLabel } from "../../documents/useDocumentLabel";
import { getTemplateFieldsAsync } from "../../documents/template-fields";
import Table from "../../documents/components/Table";
import { useClient } from "../../client";
import { addDocumentImport } from "../../custom-events";
import { useFieldFocus } from "../../field-focus";
import { useCurrentFolder } from "../FolderPageContext";
import Space from "./Space";
import Loader from "../../elements/Loader";
import { useDeleteForm } from "./useDeleteForm";
import { isDefaultField } from "@storyflow/fields-core/default-fields";
import { calculateRootFieldFromRecord } from "@storyflow/fields-core/calculate-server";
import { useTemplate } from "../../fields/default/useFieldTemplate";
import { getPreview } from "../../fields/default/getPreview";
import { Menu } from "../../elements/Menu";
import { useFolder } from "../FoldersContext";
import { useCollab } from "../../collab/CollabContext";
import { DocumentAddTransactionEntry } from "operations/actions";

function useNewDocuments(folderId: FolderId) {
  const [docs, setDocs] = React.useState<DocumentId[]>([]);

  const collab = useCollab();

  React.useLayoutEffect(() => {
    const queue = collab
      .getTimeline("documents")!
      .getQueue<DocumentAddTransactionEntry>();
    return queue.register(() => {
      const docs = new Set<DocumentId>();
      queue.forEach(({ transaction }) => {
        transaction.forEach((entry) => {
          if (entry[0] === folderId) {
            entry[1].forEach((operation) => {
              if (operation[0] === "add") {
                docs.add(operation[1]);
              } else if (operation[0] === "remove") {
                docs.delete(operation[1]);
              }
            });
          }
        });
      });
      const array = Array.from(docs).reverse();
      setDocs((ps) => {
        if (
          array.length !== ps.length ||
          !array.every((el, index) => ps[index] === el)
        ) {
          return array;
        }
        return ps;
      });
    });
  }, [collab]);

  return docs;
}

export function DocumentListSpace({
  spaceId,
  folderId,
  hidden,
  index,
}: {
  spaceId: SpaceId;
  folderId: FolderId;
  hidden: boolean;
  index: number;
}) {
  const newDocuments = useNewDocuments(folderId);
  const { form, handleDelete } = useDeleteForm({ folderId, newDocuments });

  const { documents } = useDocumentList(folderId);

  const folder = useFolder(folderId);
  const template = (useTemplate(folder.template) ?? [])
    .filter((el) => !isDefaultField(el.id, "label"))
    .slice(0, 3);

  const labels = React.useMemo(
    () => ["Navn", ...template.map((el) => el.label)],
    [template]
  );

  const rows = React.useMemo(() => {
    const rows: { id: string; columns: any[] }[] = [];
    newDocuments.forEach((id) =>
      rows.push({
        id,
        columns: [
          {
            value: (
              <LinkableLabel id={id}>
                <span className="text-yellow-400">Nyt dokument</span>
              </LinkableLabel>
            ),
          },
          ...template.map((field) => ({
            value: "",
          })),
        ],
      })
    );
    (documents ?? []).forEach((el) =>
      rows.push({
        id: el._id,
        columns: [
          {
            value: (
              <LinkableLabel id={el._id}>
                {getDocumentLabel(el) || "[Ingen titel]"}
              </LinkableLabel>
            ),
          },
          ...template.map((field) => ({
            value: getPreview(
              calculateRootFieldFromRecord(
                createTemplateFieldId(el._id, field.id),
                el.record
              )
            ),
          })),
        ],
      })
    );
    return rows;
  }, [newDocuments, documents, template]);

  return (
    <>
      <Space
        id={spaceId}
        label={
          <>
            Data
            <AddDocumentButton folder={folderId} />
          </>
        }
        buttons={
          <>
            <Space.Button icon={TrashIcon} onClick={handleDelete} />
            <Menu as={Space.Button} icon={EllipsisHorizontalIcon} align="right">
              <ImportButton />
              <ExportButton />
            </Menu>
          </>
        }
      >
        {!documents && (
          <div className="ml-9">
            <Loader size="md" />
          </div>
        )}
        <form
          ref={form}
          onSubmit={(ev) => ev.preventDefault()}
          className={cl(
            "transition-opacity duration-300",
            !documents ? "opacity-0" : "opacity-100"
          )}
        >
          <Table labels={labels} rows={rows} />
        </form>
      </Space>
    </>
  );
}

function LinkableLabel({
  id,
  children,
}: {
  id: DocumentId;
  children: React.ReactNode;
}) {
  const [focused] = useFieldFocus();

  const folder = useCurrentFolder();

  return (
    <span
      className={cl(focused && "cursor-alias")}
      onMouseDown={(ev) => {
        if (!focused) return;
        ev.preventDefault();
        addDocumentImport.dispatch({
          documentId: id as DocumentId,
          templateId: folder?.template,
        });
      }}
      onClick={(ev) => {
        if (!focused) return;
        ev.stopPropagation();
      }}
    >
      {children}
    </span>
  );
}

function ImportButton() {
  const handleImport = () => {};

  return (
    <Menu.Item
      label="Importer dokumenter"
      icon={ArrowUpTrayIcon}
      onClick={handleImport}
    />
  );
}

function ExportButton() {
  const folder = useCurrentFolder();

  const { documents } = useDocumentList(folder?._id);

  const client = useClient();

  const handleExport = async () => {
    if (!documents || !folder?.template) return;
    const templateDocument = await fetchDocument(folder.template, client);
    if (!templateDocument) return;
    const fields = await getTemplateFieldsAsync(
      templateDocument.config,
      client
    );
    const ids = fields.map((el) => el.id);
    const header = fields.map((el) => el.label);
    const rows = documents.map((el) =>
      ids.map((id) =>
        JSON.stringify(calculateRootFieldFromRecord(id, el.record)?.[0] ?? "")
      )
    );
    let csvContent =
      "data:text/csv;charset=utf-8," +
      header.join(",") +
      "\n" +
      rows.map((e) => e.join(",")).join("\n");
    // window.open(encodeURI(csvContent));
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.style.display = "none";
    link.setAttribute("download", `${folder.label}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Menu.Item
      label="Eksporter dokumenter"
      icon={ArrowDownTrayIcon}
      onClick={handleExport}
    />
  );
}

function AddDocumentButton({ folder }: { folder: FolderId }) {
  const template = useCurrentFolder()?.template;
  const addDocument = useAddDocument({ navigate: true });

  return (
    <button
      className={cl(
        "rounded-full px-2 py-0.5 text-xs ring-button text-gray-600 dark:text-gray-400 ml-3 flex-center gap-1"
        // "opacity-0 group-hover/space:opacity-100 transition-opacity"
      )}
      onClick={() => addDocument({ folder, template })}
    >
      <PlusIcon className="w-3 h-3" /> Tilføj
    </button>
  );
}
