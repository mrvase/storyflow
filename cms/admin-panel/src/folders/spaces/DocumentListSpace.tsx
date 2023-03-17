import cl from "clsx";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { computeFieldId } from "@storyflow/backend/ids";
import { DocumentId, FolderId, SpaceId } from "@storyflow/backend/types";
import React from "react";
import {
  fetchArticle,
  useArticleList,
  useArticleListMutation,
} from "../../documents";
import { getDocumentLabel } from "../../documents/useDocumentLabel";
import {
  getDefaultValuesFromTemplateAsync,
  getTemplateFieldsAsync,
} from "../../documents/template-fields";
import Table from "../../documents/components/Table";
import { useClient } from "../../client";
import { addDocumentImport } from "../../custom-events";
import { useFieldFocus } from "../../field-focus";
import { useSegment } from "../../layout/components/SegmentContext";
import { useTabUrl } from "../../layout/utils";
import { useCurrentFolder } from "../FolderPageContext";
import Space from "./Space";
import Loader from "../../elements/Loader";
import { useDeleteForm } from "./useDeleteForm";
import { FIELDS } from "@storyflow/backend/fields";
import { useDocumentIdGenerator } from "../../id-generator";
import { calculateFromRecord } from "@storyflow/backend/calculate";

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
  const { form, handleDelete } = useDeleteForm({ folderId });

  const { articles } = useArticleList(folderId);

  if (!articles) {
    return (
      <Space label="Data" buttons={<></>}>
        <div className="ml-9">
          <Loader size="md" />
        </div>
      </Space>
    );
  }

  const rows = articles.map((el) => ({
    id: el._id,
    columns: [
      {
        value: (
          <LinkableLabel id={el._id}>
            {getDocumentLabel(el) || "[Ingen titel]"}
          </LinkableLabel>
        ),
      },
    ],
  }));

  return (
    <>
      <Space
        label="Data"
        buttons={
          <>
            <ImportButton />
            <ExportButton />
            <Space.Button icon={TrashIcon} onClick={handleDelete} />
            <AddArticleButton folder={folderId} />
          </>
        }
      >
        <form
          ref={form}
          onSubmit={(ev) => ev.preventDefault()}
          className="px-2.5"
        >
          <Table rows={rows} />
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

  return <Space.Button icon={ArrowUpTrayIcon} onClick={handleImport} />;
}

function ExportButton() {
  const folder = useCurrentFolder();

  const { articles } = useArticleList(folder?._id);

  const client = useClient();

  const handleExport = async () => {
    if (!articles || !folder?.template) return;
    const templateArticle = await fetchArticle(folder.template, client);
    if (!templateArticle) return;
    const fields = await getTemplateFieldsAsync(templateArticle.config, client);
    const ids = fields.map((el) => el.id);
    const header = fields.map((el) => el.label);
    const rows = articles.map((el) =>
      ids.map((id) =>
        JSON.stringify(calculateFromRecord(id, el.record)?.[0] ?? "")
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

  return <Space.Button icon={ArrowDownTrayIcon} onClick={handleExport} />;
}

function AddArticleButton({ folder }: { folder: FolderId }) {
  const template = useCurrentFolder()?.template;

  const mutateArticles = useArticleListMutation();
  const generateDocumentId = useDocumentIdGenerator();
  const [, navigateTab] = useTabUrl();
  const { current } = useSegment();
  const client = useClient();

  const addArticle = async () => {
    try {
      const id = generateDocumentId();
      const record = template
        ? await getDefaultValuesFromTemplateAsync(id, template, {
            client,
            generateDocumentId,
          })
        : {};

      record[computeFieldId(id, FIELDS.creation_date.id)] = {
        type: null,
        children: [new Date()],
      };

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
    } catch (err) {
      console.log(err);
    }
  };
  return (
    <button
      className="px-3 rounded py-1.5 ring-button text-button"
      onClick={addArticle}
    >
      <PlusIcon className="w-4 h-4" />
    </button>
  );
}
