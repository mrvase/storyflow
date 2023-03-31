import { CubeIcon } from "@heroicons/react/24/outline";
import { getDocumentId } from "@storyflow/backend/ids";
import { DocumentId, TokenStream } from "@storyflow/backend/types";
import {
  RegularOptions,
  Option as PropOption,
} from "@storyflow/frontend/types";
import React from "react";
import { useClientConfig } from "../../client-config";
import { useDocumentIdGenerator } from "../../id-generator";
import { createComponent } from "../Editor/createComponent";
import { useFieldId } from "../FieldIdContext";
import { markMatchingString } from "../query/helpers";
import { Option } from "./Option";

export function ElementPrompt({
  prompt,
  options: optionsFromProps,
  replacePromptWithStream,
}: {
  prompt: string;
  options: RegularOptions;
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const id = useFieldId();
  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const defaultOptions = React.useMemo(() => {
    return (optionsFromProps as PropOption[]).filter(
      (el): el is string => typeof el === "string"
    );
  }, [optionsFromProps]);

  const { libraries } = useClientConfig();

  let options = libraries
    .map((library) =>
      Object.values(library.components).map((component) => ({
        ...component,
        libraryName: library.name,
        libraryLabel: library.label,
      }))
    )
    .flat(1);

  if (defaultOptions.length > 0) {
    options = options.filter((el) =>
      defaultOptions.includes(`${el.libraryName}:${el.name}`)
    );
  } else {
    options = options.filter((el) => !el.hidden);
  }

  const filtered = prompt
    ? options.filter(({ label }) =>
        label.toLowerCase().startsWith(prompt.toLowerCase())
      )
    : options;

  const onEnter = React.useCallback(
    (config: (typeof filtered)[number]) => {
      replacePromptWithStream([
        createComponent(generateDocumentId(documentId), config.name, {
          library: config.libraryName,
          libraries,
        }),
      ]);
    },
    [generateDocumentId]
  );

  return (
    <div className="p-2.5">
      <div className="font-normal opacity-50 mb-1 ml-1">Vælg element</div>
      {filtered.map((el) => (
        <Option
          key={`${el.libraryName}:${el.name}`}
          value={el}
          onEnter={onEnter}
          Icon={CubeIcon}
          // secondaryText={markMatchingString(el.name, prompt)}
        >
          {markMatchingString(el.label, prompt)}
        </Option>
      ))}
    </div>
  );
}