import cl from "clsx";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  getDocumentId,
  getTemplateFieldId,
  minimizeId,
  replaceDocumentId,
  restoreId,
} from "@storyflow/backend/ids";
import { CREATION_DATE_ID } from "@storyflow/backend/templates";
import { DocumentId } from "@storyflow/backend/types";
import React from "react";
import { tools } from "shared/editor-tools";
import {
  fetchArticle,
  getDefaultValuesFromTemplateAsync,
  getDocumentLabel,
  getTemplateFieldsAsync,
  useArticleList,
  useArticleListMutation,
} from "../../articles";
import Table from "../../articles/components/Table";
import { useClient } from "../../client";
import { addDocumentImport } from "../../custom-events";
import { useFieldFocus } from "../../field-focus";
import { useArticleIdGenerator } from "../../id-generator";
import { useSegment } from "../../layout/components/SegmentContext";
import { useTabUrl } from "../../layout/utils";
import { useCurrentFolder } from "../FolderPageContext";
import Space from "./Space";
import Loader from "../../elements/Loader";
import { useDeleteForm } from "./useDeleteForm";

export function DocumentListSpace({
  spaceId,
  folderId,
  hidden,
  index,
  rows: rowsFromProps,
}: {
  spaceId: string;
  folderId: string;
  hidden: boolean;
  index: number;
  rows?: any;
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
    id: restoreId(el.id),
    columns: [
      {
        value: <LinkableLabel id={el.id}>{getDocumentLabel(el)}</LinkableLabel>,
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
          documentId: minimizeId(id) as DocumentId,
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

  const { articles } = useArticleList(folder?.id);

  const client = useClient();

  const handleExport = async () => {
    if (!articles || !folder?.template) return;
    const templateArticle = await fetchArticle(folder.template, client);
    if (!templateArticle) return;
    const fields = await getTemplateFieldsAsync(templateArticle.config, client);
    const ids = fields.map((el) => el.id);
    const header = fields.map((el) => el.label);
    const rows = articles.map((el) =>
      ids.map(
        (id) => JSON.stringify(el.values[getTemplateFieldId(id)]?.[0]) ?? ""
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

function AddArticleButton({ folder }: { folder: string }) {
  const template = useCurrentFolder()?.template;

  const mutateArticles = useArticleListMutation();
  const generateId = useArticleIdGenerator();
  const [, navigateTab] = useTabUrl();
  const { current } = useSegment();
  const client = useClient();

  const addArticle = async () => {
    try {
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
      mutateArticles({
        folder,
        actions: [
          {
            type: "insert",
            id,
            values: Object.assign(defaultValues?.values ?? {}, {
              [CREATION_DATE_ID]: [new Date()],
            }),
            compute,
          },
        ],
      });
      navigateTab(`${current}/d-${restoreId(id)}`, { navigate: true });
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
