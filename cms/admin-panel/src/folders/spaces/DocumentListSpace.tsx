import cl from "clsx";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  createTemplateFieldId,
  getTemplateDocumentId,
} from "@storyflow/backend/ids";
import { DocumentId, FolderId, SpaceId } from "@storyflow/backend/types";
import React from "react";
import {
  fetchArticle,
  useOptimisticDocumentList,
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
import { useCurrentFolder } from "../FolderPageContext";
import Space from "./Space";
import Loader from "../../elements/Loader";
import { useDeleteForm } from "./useDeleteForm";
import { DEFAULT_FIELDS, isDefaultField } from "@storyflow/backend/fields";
import { useDocumentIdGenerator } from "../../id-generator";
import { calculateFromRecord } from "@storyflow/backend/calculate";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";
import { usePanel, useRoute } from "../../panel-router/Routes";
import { useTemplate } from "../../fields/default/useFieldTemplate";
import { useFolder } from "../collab/hooks";
import { getPreview } from "../../fields/default/getPreview";
import { Menu } from "../../layout/components/Menu";

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

  const { articles } = useOptimisticDocumentList(folderId);

  const folder = useFolder(folderId);
  const template = (useTemplate(folder.template) ?? [])
    .filter((el) => !isDefaultField(el.id, "label"))
    .slice(0, 3);

  const labels = React.useMemo(
    () => ["Navn", ...template.map((el) => el.label)],
    [template]
  );

  const rows = React.useMemo(
    () =>
      (articles ?? []).map((el) => ({
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
              calculateFromRecord(
                createTemplateFieldId(el._id, field.id),
                el.record
              )
            ),
          })),
        ],
      })),
    [articles, template]
  );

  return (
    <>
      <Space
        id={spaceId}
        label={
          <>
            Data
            <AddArticleButton folder={folderId} />
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
        {!articles && (
          <div className="ml-9">
            <Loader size="md" />
          </div>
        )}
        <form
          ref={form}
          onSubmit={(ev) => ev.preventDefault()}
          className={cl(
            "transition-opacity duration-300",
            !articles ? "opacity-0" : "opacity-100"
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

  const { articles } = useOptimisticDocumentList(folder?._id);

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

  return (
    <Menu.Item
      label="Eksporter dokumenter"
      icon={ArrowDownTrayIcon}
      onClick={handleExport}
    />
  );
}

function AddArticleButton({ folder }: { folder: FolderId }) {
  const template = useCurrentFolder()?.template;

  const mutateArticles = useArticleListMutation();
  const generateDocumentId = useDocumentIdGenerator();
  const [, navigate] = usePanel();
  const route = useRoute();
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

      record[createTemplateFieldId(id, DEFAULT_FIELDS.creation_date.id)] = {
        ...DEFAULT_SYNTAX_TREE,
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
      navigate(`${route}/d${id}`, { navigate: true });
    } catch (err) {
      console.log(err);
    }
  };
  return (
    <button
      className={cl(
        "rounded-full px-2 py-0.5 text-xs ring-button text-gray-400 ml-3 flex-center gap-1"
        // "opacity-0 group-hover/space:opacity-100 transition-opacity"
      )}
      onClick={addArticle}
    >
      <PlusIcon className="w-3 h-3" /> Tilføj
    </button>
  );
}
