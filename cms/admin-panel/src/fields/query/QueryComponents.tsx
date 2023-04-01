import { DocumentId, TokenStream } from "@storyflow/backend/types";
import { CubeIcon } from "@heroicons/react/24/outline";
import React from "react";
import { useClientConfig } from "../../client-config";
import { createComponent } from "../Editor/createComponent";
import { RegularOptions, Option } from "@storyflow/frontend/types";
import { Option as OptionComponent } from "./Option";
import { markMatchingString } from "./helpers";
import { useFieldId } from "../FieldIdContext";
import { getDocumentId } from "@storyflow/backend/ids";
import { useDocumentIdGenerator } from "../../id-generator";

export function QueryComponents({
  query,
  selected,
  insertBlock,
  insertComputation,
  options: optionsFromProps,
}: {
  query: string;
  selected: number;
  insertBlock: (comp: TokenStream) => void;
  insertComputation: (comp: TokenStream) => void;
  options: RegularOptions;
}) {
  const id = useFieldId();
  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const defaultOptions = React.useMemo(() => {
    return (optionsFromProps as Option[]).filter(
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

  const filtered = query
    ? options.filter(({ label }) =>
        label.toLowerCase().startsWith(query.toLowerCase())
      )
    : options;

  const current = selected < 0 ? selected : selected % filtered.length;

  const onEnter = React.useCallback(
    (config: (typeof filtered)[number]) => {
      if (config.inline) {
        insertComputation([
          createComponent(generateDocumentId(documentId), config.name, {
            library: config.libraryName,
            libraries,
          }),
        ]);
      } else {
        insertBlock([
          createComponent(generateDocumentId(documentId), config.name, {
            library: config.libraryName,
            libraries,
          }),
        ]);
      }
    },
    [insertComputation, insertBlock, generateDocumentId]
  );

  return (
    <>
      {filtered.map((el, index) => (
        <OptionComponent
          key={`${el.libraryName}:${el.name}`}
          value={el}
          onEnter={onEnter}
          isSelected={index === current}
          Icon={CubeIcon}
          secondaryText={markMatchingString(el.name, query)}
        >
          {markMatchingString(el.label, query)}
        </OptionComponent>
      ))}
    </>
  );
}
