import cl from "clsx";
import {
  EllipsisHorizontalIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { createTemplateFieldId } from "@storyflow/cms/ids";
import { useDocumentList } from "../../documents";
import Space from "./Space";
import Loader from "../../elements/Loader";
import { useDeleteForm } from "./useDeleteForm";
import type { FolderId } from "@storyflow/shared/types";
import type { AppSpace, DBDocument } from "@storyflow/cms/types";
import React from "react";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";
import { AddDocumentDialog, useAddDocumentDialog } from "../AddDocumentDialog";
import { createTransaction } from "@storyflow/collab/utils";
import { usePush } from "../../collab/CollabContext";
import { FolderTransactionEntry } from "../../operations/actions";
import { Menu } from "../../elements/Menu";
import { useAddDocument } from "../../documents/useAddDocument";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";
import { insertRootInTransforms } from "@storyflow/cms/transform";
import { useNewDocuments } from "./useNewDocuments";
import DocumentTable from "../../documents/components/DocumentTable";
import { useTranslation } from "../../translation/TranslationContext";

export function PagesSpace({
  space,
  folderId,
  hidden,
  index,
}: {
  space: AppSpace;
  folderId: FolderId;
  hidden: boolean;
  index: number;
}) {
  const t = useTranslation();

  const { documents } = useDocumentList(folderId);

  const newDocuments = useNewDocuments(folderId, {
    includeUrl: true,
    externalDocuments: documents,
  });

  const { form, handleDelete } = useDeleteForm({
    folderId,
    newDocuments: newDocuments.map(({ id }) => id),
  });

  const rows = React.useMemo(() => {
    if (!documents) return [];

    const getUrlLength = (url: string) => {
      return url === "/" ? 0 : url.split("/").length - 1;
    };

    const documentsWithLengths: (DBDocument & {
      indent: number;
      url: string;
      label?: string;
    })[] = documents.map((el) => {
      const urlId = createTemplateFieldId(el._id, DEFAULT_FIELDS.url.id);
      const url =
        (calculateRootFieldFromRecord(urlId, el.record)?.[0] as string) ?? "";
      return {
        ...el,
        url,
        indent: getUrlLength(url),
      };
    });

    newDocuments.forEach(({ id, label, url }) =>
      documentsWithLengths.push({
        _id: id,
        record: {},
        config: [],
        versions: { config: [0] },
        url: url!,
        indent: getUrlLength(url!),
        label,
      })
    );

    documentsWithLengths.sort((a, b) => {
      return a.indent - b.indent || (a._id > b._id ? -1 : 1);
    });

    const docs: (DBDocument & {
      indent: number;
      url: string;
      label?: string;
    })[] = [];

    documentsWithLengths.forEach((doc) => {
      const parentIndex = docs.findIndex(
        (el) => el.url === doc.url.split("/").slice(0, -1).join("/")
      );
      if (parentIndex >= 0) {
        docs.splice(parentIndex + 1, 0, doc);
      } else {
        docs.push(doc);
      }
    });

    return docs;
  }, [documents, newDocuments]);

  const [parentUrl, addDocumentWithUrl, close] = useAddDocumentDialog();

  const push = usePush<FolderTransactionEntry>("folders");
  const handleDeleteSpace = () => {
    push(
      createTransaction((t) => t.target(folderId).splice({ index, remove: 1 }))
    );
  };

  const button = React.useMemo(() => {
    return {
      label: t.documents.addSubPage(),
      icon: PlusIcon,
      onClick(doc: DBDocument) {
        addDocumentWithUrl(doc);
      },
    };
  }, []);

  const columns = React.useMemo(() => {
    return [
      {
        id: DEFAULT_FIELDS.label.id,
        label: t.general.title(),
      },
    ];
  }, []);

  return (
    <Space
      space={space}
      index={index}
      label={
        <>
          {t.documents.pages()}
          {rows.length === 0 ? <AddFrontPageButton folder={folderId} /> : null}
        </>
      }
      buttons={
        <>
          <Space.Button icon={TrashIcon} onClick={handleDelete} />
          <Menu as={Space.Button} icon={EllipsisHorizontalIcon} align="right">
            <Menu.Item
              label={t.folders.deleteSpace()}
              icon={TrashIcon}
              onClick={handleDeleteSpace}
            />
          </Menu>
        </>
      }
    >
      {folderId && (
        <AddDocumentDialog
          isOpen={Boolean(parentUrl)}
          close={close}
          folder={folderId}
          parentUrl={parentUrl}
          type="app"
        />
      )}
      {!documents && (
        <div className="ml-9">
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
        <DocumentTable columns={columns} documents={rows} button={button} />
      </form>
    </Space>
  );
}

function AddFrontPageButton({ folder }: { folder: FolderId }) {
  const t = useTranslation();

  const addDocument = useAddDocument({ navigate: true });

  return (
    <button
      className={cl(
        "rounded-full px-2 py-0.5 text-xs ring-button text-gray-600 dark:text-gray-400 ml-3 flex-center gap-1"
        // "opacity-0 group-hover/space:opacity-100 transition-opacity"
      )}
      onClick={() =>
        addDocument({
          folder,
          createRecord: (id) => ({
            [createTemplateFieldId(id, DEFAULT_FIELDS.creation_date.id)]: {
              ...DEFAULT_SYNTAX_TREE,
              children: [new Date()],
            },
            [createTemplateFieldId(id, DEFAULT_FIELDS.url.id)]:
              insertRootInTransforms(
                {
                  ...DEFAULT_SYNTAX_TREE,
                  children: ["", "/", ""],
                },
                DEFAULT_FIELDS.url.initialValue.transforms
              ),
            [createTemplateFieldId(id, DEFAULT_FIELDS.label.id)]: {
              ...DEFAULT_SYNTAX_TREE,
              children: ["Forside"],
            },
          }),
        })
      }
    >
      <PlusIcon className="w-3 h-3" /> {t.documents.addFrontPage()}
    </button>
  );
}
