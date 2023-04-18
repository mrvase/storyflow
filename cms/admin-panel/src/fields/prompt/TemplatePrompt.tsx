import { DocumentId, TokenStream } from "@storyflow/backend/types";
import {
  getDocumentId,
  getRawDocumentId,
  getRawFieldId,
} from "@storyflow/backend/ids";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import React from "react";
import { Option } from "./Option";
import { useFieldId } from "../FieldIdContext";
import { markMatchingString } from "./helpers";
import { useFieldConfig } from "../../documents/collab/hooks";
import { useOptimisticDocumentList } from "../../documents";
import { TEMPLATE_FOLDER } from "@storyflow/backend/constants";
import { FieldOperation } from "shared/operations";
import { useDocumentMutate } from "../../documents/collab/DocumentCollabContext";
import { usePath } from "../Path";
import { useClientConfig } from "../../client-config";
import { $exitPromptNode } from "./utils";
import { useEditorContext } from "../../editor/react/EditorProvider";

export function TemplatePrompt({ prompt }: { prompt: string }) {
  const fieldId = useFieldId();

  const { push } = useDocumentMutate<FieldOperation>(
    getDocumentId(fieldId),
    getRawFieldId(fieldId)
  );

  const { documents: templates = [] } =
    useOptimisticDocumentList(TEMPLATE_FOLDER);

  const path = usePath();
  const dataFieldId = path.slice(-1)[0];

  console.log("ELEMENT ID", dataFieldId);

  const editor = useEditorContext();
  const { libraries } = useClientConfig();

  const onEnter = React.useCallback(
    (id: DocumentId | null) => {
      editor.update(() => {
        $exitPromptNode(libraries);
      });
      push([
        dataFieldId,
        [
          {
            name: "template",
            value: id === null ? null : getRawDocumentId(id),
          },
        ],
      ]);
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
