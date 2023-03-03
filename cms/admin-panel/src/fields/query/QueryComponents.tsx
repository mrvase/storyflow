import { EditorComputation } from "@storyflow/backend/types";
import { CubeIcon } from "@heroicons/react/24/outline";
import React from "react";
import { useClientConfig } from "../../client-config";
import { createComponent } from "../Editor/createComponent";
import { RegularOptions, Option } from "@storyflow/frontend/types";
import { Option as OptionComponent } from "./Option";
import { markMatchingString } from "./helpers";

export function QueryComponents({
  query,
  selected,
  insertBlock,
  insertComputation,
  options: optionsFromProps,
}: {
  query: string;
  selected: number;
  insertBlock: (comp: EditorComputation) => void;
  insertComputation: (comp: EditorComputation) => void;
  options: RegularOptions;
}) {
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
          createComponent(config.name, {
            library: config.libraryName,
            libraries,
          }),
        ]);
      } else {
        insertBlock([
          createComponent(config.name, {
            library: config.libraryName,
            libraries,
          }),
        ]);
      }
    },
    [insertComputation, insertBlock]
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