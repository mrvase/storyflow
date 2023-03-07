import React from "react";
import Content from "./Content";
import { DocumentDuplicateIcon, TrashIcon } from "@heroicons/react/24/outline";
import { DragIcon } from "../../folders/spaces/DragIcon";
import { useDragItem } from "@storyflow/dnd";
import { DBFolder } from "@storyflow/backend/types";
import { DocumentListSpace } from "../../folders/spaces/DocumentListSpace";
import { useTemplateFolder } from "../../folders";
import { FolderContext } from "../../folders/FolderPageContext";
import Space from "../../folders/spaces/Space";
import { useDeleteForm } from "../../folders/spaces/useDeleteForm";
import Table from "../../articles/components/Table";
import { useArticleList } from "../../articles";
import Loader from "../../elements/Loader";
import { restoreId } from "@storyflow/backend/ids";

export function SystemTemplatePage() {
  const folder = useTemplateFolder();
  const { form, handleDelete } = useDeleteForm({ folderId: folder.id });

  const { articles } = useArticleList(folder.id);

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
        value: el.label!,
      },
    ],
  }));

  return (
    <FolderContext.Provider value={folder}>
      <Content selected icon={DocumentDuplicateIcon} header="Alle skabeloner">
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
      </Content>
    </FolderContext.Provider>
  );
}

function DragButton({ folder }: { folder: DBFolder }) {
  const { ref, dragHandleProps } = useDragItem({
    id: `new-folder-${folder.id}`,
    type: "folders",
    item: folder,
    mode: "move",
  });

  return (
    <div ref={ref} {...dragHandleProps} className="cursor-grab">
      <DragIcon className="w-4 h-4" />
    </div>
  );
}
