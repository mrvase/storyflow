import type {
  ContextToken,
  DocumentId,
  FieldId,
  NestedDocumentId,
} from "@storyflow/shared/types";
import {
  computeFieldId,
  getDocumentId,
  getIdFromString,
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
import { useNestedEntity, usePath } from "../Path";
import { getConfigFromType, useAppConfig } from "../../AppConfigContext";
import { $exitPromptNode } from "./utils";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { FieldTransactionEntry } from "../../operations/actions";
import { usePush } from "../../collab/CollabContext";
import { createTransaction } from "@storyflow/collab/utils";
import { getDocumentLabel } from "../../documents/useDocumentLabel";
import { useTranslation } from "../../translation/TranslationContext";
import { useGlobalState } from "../../state/state";
import { getRecordSnapshot } from "../traverse";
import { tokens } from "@storyflow/cms/tokens";
import { extendPath } from "../../utils/extendPath";
import { TokenStream } from "../../operations/types";

export function FormPrompt({
  actionFieldId,
  prompt,
  replacePromptWithStream,
}: {
  actionFieldId: FieldId;
  prompt: string;
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const t = useTranslation();
  const fieldId = useFieldId();

  const { configs } = useAppConfig();

  const path = usePath();

  const index = path.findIndex((el) => el === actionFieldId);

  const [parentFieldId, elementId] = path.slice(index - 2, index) as [
    FieldId,
    NestedDocumentId,
    FieldId
  ];

  const element = useNestedEntity({
    documentId: elementId,
    fieldId: parentFieldId,
  });

  if (!tokens.isNestedElement(element)) {
    throw new Error("Cannot find parent element for form propmt");
  }

  const config = getConfigFromType(element.element, configs);

  if (!config) {
    throw new Error("Cannot find parent element config for form propmt");
  }

  const childrenPropName = Object.entries(config.props).find(
    ([, config]) => config.type === "children"
  )?.[0];

  if (!childrenPropName) {
    throw new Error("Actionable component has no children");
  }

  const childFieldId = computeFieldId(
    elementId,
    getIdFromString(childrenPropName)
  );

  const [inputs] = useGlobalState(`${actionFieldId}/inputs`, () => {
    const inputs: { value: string; label: string }[] = [];
    getRecordSnapshot(childFieldId, (value) => value, {
      configs,
      transform: (el, props, config) => {
        Object.entries(config).forEach(([key, config]) => {
          if (config.type !== "input") return;
          const labelId = computeFieldId(
            el.id,
            getIdFromString(extendPath(key, "label", "#"))
          );
          const labelValue = props[labelId];
          const label =
            Array.isArray(labelValue) && typeof labelValue[0] === "string"
              ? labelValue[0]
              : config.label;
          console.log("PROPS", labelId, props);
          inputs.push({
            value: `${el.id}/${key}`,
            label,
          });
        });
      },
    });
    return inputs;
    /*
      const result = getRecordSnapshot(
        dataFieldId,
        (value, fieldId) => value,
        {
          configs,
          transform: (el, props) => ({ ...el, props }),
        }
      );
      */
  });

  const onEnter = React.useCallback(
    (id: string) => {
      const nestedField: ContextToken = {
        ctx: `form:${id}`,
      };
      replacePromptWithStream([nestedField]);
    },
    [replacePromptWithStream, actionFieldId, configs]
  );

  const options = inputs.filter((el) =>
    el.label.toLowerCase().startsWith(prompt.toLowerCase())
  );

  return (
    <div className="p-2.5">
      <div className="font-medium text-gray-400 mb-1 ml-1">Inputs</div>
      {options.map(({ value, label }) => (
        <Option
          key={value}
          value={value}
          onEnter={onEnter}
          onEnterLabel={t.documents.applyTemplate()}
          Icon={DocumentDuplicateIcon}
        >
          {label}
        </Option>
      ))}
    </div>
  );
}
