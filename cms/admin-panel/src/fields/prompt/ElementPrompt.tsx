import { CubeIcon } from "@heroicons/react/24/outline";
import { getDocumentId } from "@storyflow/cms/ids";
import type { DocumentId } from "@storyflow/shared/types";
import type { TokenStream } from "../../operations/types";
import type {
  RegularOptions,
  Option as PropOption,
} from "@storyflow/shared/types";
import React from "react";
import { useAppConfig } from "../../client-config";
import { useDocumentIdGenerator } from "../../id-generator";
import { createComponent } from "../Editor/createComponent";
import { useFieldId } from "../FieldIdContext";
import { markMatchingString } from "./helpers";
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

  const elementOptions = React.useMemo(() => {
    return (optionsFromProps as PropOption[]).filter(
      (el): el is string => typeof el === "string"
    );
  }, [optionsFromProps]);

  const { libraries } = useAppConfig();

  let options = libraries
    .map((library) =>
      Object.values(library.components).map((component) => ({
        ...component,
        libraryName: library.name,
        libraryLabel: library.label,
      }))
    )
    .flat(1);

  if (elementOptions.length > 0) {
    const defaultOptions = options.filter((el) => el.libraryName === "");
    options = options.filter((el) =>
      elementOptions.includes(`${el.libraryName}:${el.name}`)
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
          libraries,
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
