import React from "react";
import Dialog from "../elements/Dialog";
import { useDocumentList } from "../documents";
import { useAddDocument } from "../documents/useAddDocument";
import { DialogOption } from "../elements/DialogOption";
import { DocumentDuplicateIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useTemplateFolder } from "./FoldersContext";
import type { DocumentId, FolderId } from "@storyflow/shared/types";
import { usePush } from "../collab/CollabContext";
import { createTransaction } from "@storyflow/collab/utils";
import { FolderTransactionEntry } from "../operations/actions";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";
import { createTemplateFieldId } from "@storyflow/cms/ids";
import { getDocumentLabel } from "../documents/useDocumentLabel";
import { useTranslation } from "../translation/TranslationContext";

export function AddTemplateDialog({
  isOpen,
  close,
  folderId,
  currentTemplate,
}: {
  isOpen: boolean;
  close: () => void;
  folderId: FolderId;
  currentTemplate?: string;
}) {
  const t = useTranslation();

  const addDocument = useAddDocument({ type: "template", navigate: true });

  const push = usePush<FolderTransactionEntry>("folders");

  const templateFolderId = useTemplateFolder()?._id;

  const onSubmit = React.useCallback(
    async (type: string, data: FormData) => {
      const label = (data.get("value") as string) ?? "";
      if (!label) return;

      let id: DocumentId;
      if (type === "new") {
        id = await addDocument({
          folderId: templateFolderId,
          createRecord: (id) => {
            return {
              [createTemplateFieldId(id, DEFAULT_FIELDS.creation_date.id)]: {
                ...DEFAULT_SYNTAX_TREE,
                children: [new Date()],
              },
              [createTemplateFieldId(id, DEFAULT_FIELDS.template_label.id)]: {
                ...DEFAULT_SYNTAX_TREE,
                children: [label],
              },
            };
          },
        });
      } else {
        id = label as DocumentId;
      }

      push(
        createTransaction((t) =>
          t.target(folderId).toggle({ name: "template", value: id })
        )
      );
      close();
    },
    [push, folderId, addDocument, templateFolderId, close]
  );

  const { documents: templates } = useDocumentList(templateFolderId);

  const templateOptions = (templates ?? []).map((el) => ({
    value: el._id,
    label: getDocumentLabel(el, t) ?? el._id,
  }));

  return (
    <Dialog isOpen={isOpen} close={close} title={t.documents.chooseTemplate()}>
      <div className="flex flex-col gap-2">
        <DialogOption
          type="existing"
          icon={DocumentDuplicateIcon}
          label={t.documents.chooseExistingTemplate()}
          input={{
            options: templateOptions,
            label: t.documents.templates(),
            button: t.general.accept(),
            defaultValue: currentTemplate,
          }}
          onSubmit={onSubmit}
        />
        <DialogOption
          type="new"
          icon={PlusIcon}
          label={t.documents.createNewTemplate()}
          onSubmit={onSubmit}
          defaultChecked
        />
      </div>
    </Dialog>
  );
}
