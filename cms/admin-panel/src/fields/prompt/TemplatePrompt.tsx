import type { DocumentId, FieldId } from "@storyflow/shared/types";
import {
  getDocumentId,
  getRawDocumentId,
  getRawFieldId,
} from "@storyflow/cms/ids";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import React from "react";
import { Option } from "./Option";
import { useFieldId } from "../FieldIdContext";
import { markMatchingString } from "./helpers";
import { useDocumentList } from "../../documents";
import { TEMPLATE_FOLDER } from "@storyflow/cms/constants";
import { usePath } from "../Path";
import { useAppConfig } from "../../client-config";
import { $exitPromptNode } from "./utils";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { FieldTransactionEntry } from "../../operations/actions";
import { usePush } from "../../collab/CollabContext";
import { createTransaction } from "@storyflow/collab/utils";

export function TemplatePrompt({ prompt }: { prompt: string }) {
  const fieldId = useFieldId();

  const push = usePush<FieldTransactionEntry>(
    getDocumentId<DocumentId>(fieldId),
    getRawFieldId(fieldId)
  );

  const { documents: templates = [] } = useDocumentList(TEMPLATE_FOLDER);

  const path = usePath();
  const dataFieldId = path.slice(-1)[0];

  console.log("ELEMENT ID", dataFieldId);

  const editor = useEditorContext();
  const { libraries } = useAppConfig();

  const onEnter = React.useCallback(
    (id: DocumentId | null) => {
      editor.update(() => {
        $exitPromptNode(libraries);
      });
      push(
        createTransaction((t) =>
          t.target(dataFieldId as FieldId).toggle({
            name: "template",
            value: id === null ? null : getRawDocumentId(id),
          })
        )
      );
    },
    [push, dataFieldId, libraries]
  );

  const options = templates
    .filter((el) => el.label!.toLowerCase().startsWith(prompt.toLowerCase()))
    .map((el) => ({
      value: el._id,
      label: markMatchingString(el.label!, prompt),
    }));

  return (
    <div className="p-2.5">
      <div className="font-medium text-gray-400 mb-1 ml-1">Skabeloner</div>
      {options.map(({ value, label }) => (
        <Option
          key={value}
          value={value}
          onEnter={onEnter}
          onEnterLabel={"Anvend"}
          Icon={DocumentDuplicateIcon}
        >
          {label}
        </Option>
      ))}
      <Option
        value={null}
        onEnter={onEnter}
        onEnterLabel={"Anvend"}
        Icon={DocumentDuplicateIcon}
      >
        Fjern
      </Option>
    </div>
  );
}
