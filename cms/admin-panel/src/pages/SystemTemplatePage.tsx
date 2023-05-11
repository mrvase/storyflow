import cl from "clsx";
import Content from "./Content";
import { DocumentDuplicateIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useTemplateFolder } from "../folders/FoldersContext";
import { FolderContext } from "../folders/FolderPageContext";
import Space from "../folders/spaces/Space";
import { useDeleteForm } from "../folders/spaces/useDeleteForm";
import Table from "../documents/components/Table";
import { useDocumentList } from "../documents";
import Loader from "../elements/Loader";
import type { SpaceId } from "@storyflow/cms/types";
import { getDocumentLabel } from "../documents/useDocumentLabel";

export function SystemTemplatePage() {
  const folder = useTemplateFolder();
  const { form, handleDelete } = useDeleteForm({ folderId: folder._id });

  const { documents } = useDocumentList(folder._id);

  const rows = (documents ?? []).map((el) => ({
    id: el._id,
    columns: [
      {
        value: getDocumentLabel(el),
      },
    ],
  }));

  return (
    <FolderContext.Provider value={folder}>
      <Content icon={DocumentDuplicateIcon} header="Alle skabeloner">
        <Space
          index={0}
          label="Sider"
          space={{ id: "system-template" as SpaceId, type: "documents" }}
          buttons={<Space.Button icon={TrashIcon} onClick={handleDelete} />}
        >
          {!documents && (
            <div className="ml-14">
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
            <Table labels={["Navn"]} rows={rows} />
          </form>
        </Space>
      </Content>
    </FolderContext.Provider>
  );
}
