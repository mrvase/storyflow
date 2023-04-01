import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { getDocumentId } from "@storyflow/backend/ids";
import { useOptimisticDocumentList } from "../../documents";
import { getDocumentLabel } from "../../documents/useDocumentLabel";
import Table from "../../documents/components/Table";
import Space from "./Space";
import { useAppPageContext } from "../AppPage";
import Loader from "../../elements/Loader";
import { useDeleteForm } from "./useDeleteForm";
import { FolderId, SpaceId } from "@storyflow/backend/types";

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

  console.log("FOLDER", folderId, articles);

  const { urls, addArticleWithUrl } = useAppPageContext();

  if (!articles) {
    return (
      <Space label="Sider" buttons={<></>}>
        <div className="ml-9">
          <Loader size="md" />
        </div>
      </Space>
    );
  }

  const rows = urls.map((el) => {
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
  });

  return (
    <>
      <Space
        label="Sider"
        buttons={<Space.Button icon={TrashIcon} onClick={handleDelete} />}
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
