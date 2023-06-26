import cl from "clsx";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { Option } from "./Option";

import { $getPromptNode } from "./utils";
import { $replaceWithBlocks } from "../Editor/insertComputation";
import { $createBlockNode } from "../Editor/decorators/BlockNode";
import { $createParagraphNode, $createTextNode } from "lexical";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { FunctionDataRecord, FunctionName } from "@storyflow/shared/types";
import React from "react";
import { SIGNATURES } from "@storyflow/cms/constants";
import { FunctionSymbol } from "@storyflow/cms/types";

const options: {
  value: FunctionName;
  label: string;
  icon?: React.ComponentType<any>;
}[] = [
  {
    value: "if",
    label: "Indsæt betingelse",
  },
  {
    value: "in",
    label: "Indsæt in",
  },
];

const converters: {
  value: FunctionName;
  label: string;
  icon?: React.ComponentType<any>;
}[] = [
  {
    value: "to_boolean",
    label: "Generer bool",
  },
  {
    value: "to_date",
    label: "Generer dato",
  },
  {
    value: "to_color",
    label: "Generer farve",
  },
  {
    value: "to_file",
    label: "Generer fil",
  },
];

export function FunctionPrompt({ prompt }: { prompt: string }) {
  const editor = useEditorContext();

  const onEnter = React.useCallback((value: FunctionName) => {
    editor.update(() => {
      $getPromptNode()?.select(0);
      const node = $createBlockNode({ [value]: true } as FunctionSymbol);
      for (let i = 0; i < SIGNATURES[value].length; i++) {
        node.append($createParagraphNode().append($createTextNode()));
      }
      $replaceWithBlocks([node]);
    });
  }, []);

  const filteredOptions = options.filter(({ value, label }) =>
    `${label}${value}`.toLowerCase().includes(prompt.toLowerCase())
  );

  const filteredConverters = converters.filter(({ label, value }) =>
    `${label}${value}`.toLowerCase().includes(prompt.toLowerCase())
  );

  return (
    <>
      <div className={cl("p-2.5", filteredOptions.length === 0 && "hidden")}>
        <div className="font-medium text-gray-400 mb-1 ml-1">
          Indsæt funktion
        </div>
        {filteredOptions.map(({ value, label }) => (
          <Option
            key={label}
            value={value}
            onEnter={onEnter}
            Icon={CalendarDaysIcon}
          >
            {label}
          </Option>
        ))}
      </div>
      <div className={cl("p-2.5", filteredConverters.length === 0 && "hidden")}>
        <div className="font-medium text-gray-400 mb-1 ml-1">
          Lav konvertering
        </div>
        {filteredConverters.map(({ value, label }) => (
          <Option
            key={label}
            value={value}
            onEnter={onEnter}
            Icon={CalendarDaysIcon}
          >
            {label}
          </Option>
        ))}
      </div>
    </>
  );
}
