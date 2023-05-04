import React from "react";
import Content from "./Content";
import { FolderIcon, TrashIcon } from "@heroicons/react/24/outline";
import Table from "../documents/components/Table";
// import { useFolders } from "../../folders/collab/hooks";
import { DragIcon } from "../folders/spaces/DragIcon";
import { useDragItem } from "@storyflow/dnd";
import type { DBFolder } from "@storyflow/db-core/types";

export function SystemFolderPage() {
  const form = React.useRef<HTMLFormElement | null>(null);

  const folders = [] as DBFolder[]; // useFolders();

  const handleDelete = () => {
    if (form.current) {
      const data = new FormData(form.current);
      const ids = Array.from(data.keys());
      if (ids.length) {
        /*
        mutateArticles({
          folder: folder.id,
          actions: ids.map((id) => ({
            type: "remove",
            id,
          })),
        });
        */
      }
    }
  };

  return (
    <Content icon={FolderIcon} header="Alle mapper">
      <div className="px-5">
        <div>
          <div className="flex items-center ml-9 mb-1 justify-between">
            <h2 className=" text-gray-400">Data</h2>
            <button
              className="px-3 rounded py-1.5 ring-button text-button"
              onClick={handleDelete}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        {folders && (
          <form ref={form} onSubmit={(ev) => ev.preventDefault()}>
            <Table
              labels={["Navn"]}
              rows={folders.map((el) => ({
                id: el._id,
                columns: [
                  { value: el.label },
                  {
                    value: <DragButton folder={el} />,
                  },
                ],
              }))}
            />
          </form>
        )}
      </div>
    </Content>
  );
}

function DragButton({ folder }: { folder: DBFolder }) {
  const { ref, dragHandleProps } = useDragItem({
    id: `new-folder-${folder._id}`,
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
