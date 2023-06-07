import { CubeIcon } from "@heroicons/react/24/outline";
import { getDocumentId } from "@storyflow/cms/ids";
import type { DocumentId } from "@storyflow/shared/types";
import type { TokenStream } from "../../operations/types";
import React from "react";
import { useAppConfig } from "../../AppConfigContext";
import { useDocumentIdGenerator } from "../../id-generator";
import { createComponent } from "../Editor/createComponent";
import { useFieldId } from "../FieldIdContext";
import { markMatchingString } from "./helpers";
import { Option } from "./Option";

export function ElementPrompt({
  prompt,
  options: optionsFromProps = [],
  replacePromptWithStream,
}: {
  prompt: string;
  options?: { value: string | number }[];
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const id = useFieldId();
  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const optionNames = new Set(optionsFromProps.map(({ value }) => value));

  const { configs } = useAppConfig();

  let options = Object.entries(configs)
    .map(([libraryName, library]) =>
      Object.entries(library.configs).map(([name, component]) => ({
        ...component,
        name: name.replace(/Config$/, ""),
        libraryName,
        libraryLabel: library.label,
      }))
    )
    .flat(1);

  if (optionsFromProps.length > 0) {
    const defaultOptions = options.filter((el) => el.libraryName === "");
    options = options.filter((el) =>
      optionNames.has(`${el.libraryName}:${el.name}`)
    );
    options.push(...defaultOptions);
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
          configs,
        }),
      ]);
    },
    [generateDocumentId]
  );

  return (
    <div className="p-2.5">
      <div className="font-medium text-gray-400 mb-1 ml-1">Vælg element</div>
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
