import Content from "./Content";
import { DocumentDuplicateIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useTemplateFolder } from "../../folders/FoldersContext";
import { FolderContext } from "../../folders/FolderPageContext";
import Space from "../../folders/spaces/Space";
import { useDeleteForm } from "../../folders/spaces/useDeleteForm";
import Table from "../../documents/components/Table";
import { useOptimisticDocumentList } from "../../documents";
import Loader from "../../elements/Loader";

export function SystemTemplatePage() {
  const folder = useTemplateFolder();
  const { form, handleDelete } = useDeleteForm({ folderId: folder._id });

  const { articles } = useOptimisticDocumentList(folder._id);

  if (!articles) {
    return (
      <Space label="Data" buttons={<></>}>
        <div className="ml-14">
          <Loader size="md" />
        </div>
      </Space>
    );
  }

  const rows = articles.map((el) => ({
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
          buttons={<Space.Button icon={TrashIcon} onClick={handleDelete} />}
        >
          <form
            ref={form}
            onSubmit={(ev) => ev.preventDefault()}
            className="px-2.5"
          >
            <Table labels={["Navn"]} rows={rows} />
          </form>
        </Space>
      </Content>
    </FolderContext.Provider>
  );
}
