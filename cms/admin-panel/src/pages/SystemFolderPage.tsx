import React from "react";
import Content from "./Content";
import { FolderIcon, TrashIcon } from "@heroicons/react/24/outline";
import Table from "../documents/components/Table";
// import { useFolders } from "../../folders/collab/hooks";
import { DragIcon } from "../elements/DragIcon";
import { useDragItem } from "@storyflow/dnd";
import type { DBFolder, DocumentSpace, SpaceId } from "@storyflow/cms/types";
import Space from "../folders/spaces/Space";
import { useTranslation } from "../translation/TranslationContext";

const space: DocumentSpace = {
  id: "" as SpaceId,
  type: "documents",
};

export function SystemFolderPage() {
  const t = useTranslation();

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
    <Content icon={FolderIcon}>
      <div className="flex flex-col gap-8">
        <Space
          space={space}
          index={0}
          label={t.folders.folders()}
          buttons={
            <>
              <Space.Button icon={TrashIcon} onClick={handleDelete} />
            </>
          }
        >
          <form
            ref={form}
            onSubmit={(ev) => ev.preventDefault()}
            className="transition-opacity duration-300"
          >
            {/*<DocumentTable columns={columns} documents={rows} />*/}
          </form>
        </Space>
      </div>
    </Content>
  );
}
