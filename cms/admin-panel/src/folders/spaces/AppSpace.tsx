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
import { useCurrentFolder } from "../FolderPage";
import Space from "./Space";
import { useAppPageContext } from "../AppPage";
import Loader from "../../elements/Loader";

export function AppSpace({
  spaceId,
  folderId,
  hidden,
  index,
}: {
  spaceId: string;
  folderId: string;
  hidden: boolean;
  index: number;
}) {
  const form = React.useRef<HTMLFormElement | null>(null);

  const mutateArticles = useArticleListMutation();

  const handleDelete = () => {
    if (form.current && folderId) {
      const data = new FormData(form.current);
      const ids = Array.from(data.keys());
      if (ids.length) {
        mutateArticles({
          folder: folderId,
          actions: ids.map((id) => ({
            type: "remove",
            id,
          })),
        });
      }
    }
  };

  const { articles } = useArticleList(folderId);

  if (!articles) {
    return (
      <Space label="Sider" buttons={<></>}>
        <div className="ml-9">
          <Loader size="md" />
        </div>
      </Space>
    );
  }

  const { urls, addArticleWithUrl } = useAppPageContext();

  const rows = urls.map((el) => {
    const id = getDocumentId(el.id);
    const doc = articles.find((a) => a.id === id)!;

    return {
      id: restoreId(id),
      columns: [
        { value: getDocumentLabel(doc) },
        {
          value: (
            <button
              className="rounded px-2 py-0.5 text-sm text-gray-800 dark:text-white text-opacity-50 hover:text-opacity-100 dark:text-opacity-50 dark:hover:text-opacity-100 ring-button flex items-center gap-2 whitespace-nowrap"
              onClick={(ev) => {
                ev.stopPropagation();
                addArticleWithUrl(doc);
              }}
            >
              <PlusIcon className="w-3 h-3" /> Tilføj underside
            </button>
          ),
        },
      ],
      indent: el.indent,
    };
  });

  return (
    <>
      <Space
        label="Sider"
        buttons={
          <>
            <Space.Button icon={TrashIcon} onClick={handleDelete} />
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
