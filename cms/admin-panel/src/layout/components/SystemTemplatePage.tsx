import cl from "clsx";
import Content from "./Content";
import { DocumentDuplicateIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useTemplateFolder } from "../../folders/FoldersContext";
import { FolderContext } from "../../folders/FolderPageContext";
import Space from "../../folders/spaces/Space";
import { useDeleteForm } from "../../folders/spaces/useDeleteForm";
import Table from "../../documents/components/Table";
import { useOptimisticDocumentList } from "../../documents";
import Loader from "../../elements/Loader";
import { SpaceId } from "@storyflow/backend/types";

export function SystemTemplatePage() {
  const folder = useTemplateFolder();
  const { form, handleDelete } = useDeleteForm({ folderId: folder._id });

  const { articles } = useOptimisticDocumentList(folder._id);

  const rows = (articles ?? []).map((el) => ({
    id: el._id,
    columns: [
      {
        value: el.label!,
      },
    ],
  }));

  return (
    <FolderContext.Provider value={folder}>
      <Content icon={DocumentDuplicateIcon} header="Alle skabeloner">
        <Space
          label="Sider"
          id={"system-template" as SpaceId}
          buttons={<Space.Button icon={TrashIcon} onClick={handleDelete} />}
        >
          {!articles && (
            <Space
              id={"system-template" as SpaceId}
              label="Data"
              buttons={<></>}
            >
              <div className="ml-14">
                <Loader size="md" />
              </div>
            </Space>
          )}
          <form
            ref={form}
            onSubmit={(ev) => ev.preventDefault()}
            className={cl(
              "transition-opacity duration-300",
              !articles ? "opacity-0" : "opacity-100"
            )}
          >
            <Table labels={["Navn"]} rows={rows} />
          </form>
        </Space>
      </Content>
    </FolderContext.Provider>
  );
}
