import cl from "clsx";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { getDocumentId } from "@storyflow/backend/ids";
import { useOptimisticDocumentList } from "../../documents";
import { getDocumentLabel } from "../../documents/useDocumentLabel";
import Table from "../../documents/components/Table";
import Space from "./Space";
import { useAppPageContext } from "../AppPageContext";
import Loader from "../../elements/Loader";
import { useDeleteForm } from "./useDeleteForm";
import { FolderId, SpaceId } from "@storyflow/backend/types";
import React from "react";

export function AppSpace({
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

  const { urls, addArticleWithUrl } = useAppPageContext();

  const rows = React.useMemo(
    () =>
      articles
        ? urls.map((el) => {
            const id = getDocumentId(el.id);
            const doc = articles.find((a) => a._id === id)!;

            return {
              id,
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
          })
        : [],
    [articles, urls]
  );

  return (
    <Space
      label="Sider"
      buttons={<Space.Button icon={TrashIcon} onClick={handleDelete} />}
    >
      {!articles && (
        <div className="ml-14">
          <Loader size="md" />
        </div>
      )}
      <form
        ref={form}
        onSubmit={(ev) => ev.preventDefault()}
        className={cl(
          "px-2.5 transition-opacity duration-300",
          !articles ? "opacity-0" : "opacity-100"
        )}
      >
        <Table labels={["Label"]} rows={rows} />
      </form>
    </Space>
  );
}
