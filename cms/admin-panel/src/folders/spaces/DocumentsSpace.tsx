import cl from "clsx";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { DocumentId, FolderId } from "@storyflow/shared/types";
import type { DBDocument, DocumentSpace } from "@storyflow/cms/types";
import React from "react";
import { fetchDocument, useDocumentList } from "../../documents";
import { useAddDocument } from "../../documents/useAddDocument";
import { getTemplateFieldsAsync } from "../../documents/template-fields";
import { addDocumentImport } from "../../custom-events";
import { useFieldFocus } from "../../FieldFocusContext";
import { useCurrentFolder } from "../FolderPageContext";
import Space from "./Space";
import Loader from "../../elements/Loader";
import { useDeleteForm } from "./useDeleteForm";
import { DEFAULT_FIELDS, isDefaultField } from "@storyflow/cms/default-fields";
import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";
import { useTemplate } from "../../fields/default/useFieldTemplate";
import { Menu } from "../../elements/Menu";
import { useFolder } from "../FoldersContext";
import { usePush } from "../../collab/CollabContext";
import {
  FolderTransactionEntry,
  SpaceTransactionEntry,
} from "../../operations/actions";
import { createTransaction } from "@storyflow/collab/utils";
import { useNewDocuments } from "./useNewDocuments";
import DocumentTable from "../../documents/components/DocumentTable";
import { useTranslation } from "../../translation/TranslationContext";
import { EditableLabel } from "../../elements/EditableLabel";
import { InlineButton } from "../../elements/InlineButton";
import { useImportContext } from "../ImportContext";
import Dialog from "../../elements/Dialog";
import { TEMPLATE_FOLDER } from "@storyflow/cms/constants";

export function DocumentsSpace({
  space,
  folderId,
  hidden,
  index,
}: {
  space: DocumentSpace;
  folderId: FolderId;
  hidden: boolean;
  index: number;
}) {
  const t = useTranslation();

  const { documents } = useDocumentList(folderId);

  const newDocuments = useNewDocuments(folderId);
  const { form, handleDelete } = useDeleteForm({
    folderId,
    newDocuments: newDocuments.map(({ id }) => id),
  });

  const folder = useFolder(folderId);
  const template = useTemplate(folder.template) ?? [];

  const columns = React.useMemo(
    () => [
      template.find((el) => isDefaultField(el.id, "label")) ?? {
        id: DEFAULT_FIELDS.label.id,
        label: DEFAULT_FIELDS.label.label,
      },
      ...template.filter((el) => !isDefaultField(el.id, "label")).slice(0, 4),
    ],
    [template]
  );

  const rows = React.useMemo(() => {
    const docs: (DBDocument & { label?: string })[] = [];
    newDocuments.forEach(({ id, label }) =>
      docs.push({
        _id: id,
        record: {},
        config: [],
        versions: { config: [0] },
        label,
      })
    );
    console.log("DOCS NOW", [...docs]);
    (documents ?? []).forEach((el) => docs.push(el));
    return docs;
  }, [newDocuments, documents, template]);

  const push = usePush<FolderTransactionEntry | SpaceTransactionEntry>(
    "folders"
  );
  const handleDeleteSpace = () => {
    push(
      createTransaction((t) => t.target(folderId).splice({ index, remove: 1 }))
    );
  };

  return (
    <Space
      space={space}
      index={index}
      label={
        <>
          <EditableLabel
            value={space.label || t.documents.documents()}
            onChange={(value) => {
              push(
                createTransaction((t) =>
                  t
                    .target(`${folderId}:${space.id}`)
                    .toggle({ name: "label", value })
                )
              );
            }}
          />
          <AddDocumentButton folderId={folderId} />
        </>
      }
      buttons={
        <>
          <Menu as={Space.Button} icon={EllipsisHorizontalIcon} align="right">
            <ImportButton folderId={folderId} />
            <ExportButton />
            <Menu.Item
              label={t.documents.deleteDocuments()}
              icon={TrashIcon}
              onClick={handleDelete}
            />
            <Menu.Item
              label={t.folders.deleteSpace()}
              icon={TrashIcon}
              onClick={handleDeleteSpace}
            />
          </Menu>
        </>
      }
    >
      {!documents && (
        <div className="ml-9 mt-2.5">
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
        <DocumentTable columns={columns} documents={rows} />
      </form>
    </Space>
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

function ImportButton({ folderId }: { folderId: FolderId }) {
  const [, setImportState] = useImportContext();
  const template = useCurrentFolder()?.template;
  const addDocument = useAddDocument({
    navigate: true,
    type: folderId === TEMPLATE_FOLDER ? "template" : "document",
  });

  const t = useTranslation();

  return (
    <Menu.Item
      label={t.documents.importDocuments()}
      icon={ArrowUpTrayIcon}
      onClick={() => {
        setImportState({ state: "open" });
        addDocument({ folderId, template });
      }}
    />
  );
}

function ExportButton() {
  const t = useTranslation();

  const folder = useCurrentFolder();

  const { documents } = useDocumentList(folder?._id);

  const handleExport = async () => {
    if (!documents || !folder?.template) return;
    const templateDocument = await fetchDocument(folder.template);
    if (!templateDocument) return;
    const fields = await getTemplateFieldsAsync(templateDocument.config);
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
      label={t.documents.exportDocuments()}
      icon={ArrowDownTrayIcon}
      onClick={handleExport}
    />
  );
}

function AddDocumentButton({ folderId }: { folderId: FolderId }) {
  const t = useTranslation();
  const template = useCurrentFolder()?.template;
  const addDocument = useAddDocument({
    navigate: true,
    type: folderId === TEMPLATE_FOLDER ? "template" : "document",
  });

  return (
    <InlineButton
      icon={PlusIcon}
      onClick={() => addDocument({ folderId, template })}
      className="ml-3"
    >
      {t.documents.addDocuments({ count: 1 })}
    </InlineButton>
  );
}
