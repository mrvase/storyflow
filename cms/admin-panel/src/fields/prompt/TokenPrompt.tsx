import cl from "clsx";
import {
  CalendarDaysIcon,
  SwatchIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { TokenStream } from "../../operations/types";
import React from "react";
import { parseDateFromString, serializeDate } from "../../data/dates";
import { Option } from "./Option";
import { DocumentId, Option as OptionType } from "@storyflow/shared/types";
import { useFieldId } from "../FieldIdContext";
import { NestedField } from "@storyflow/cms/types";
import { createTemplateFieldId, getDocumentId } from "@storyflow/cms/ids";
import { useDocumentIdGenerator } from "../../id-generator";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { $getPromptNode } from "./utils";
import { $replaceWithBlocks } from "../Editor/insertComputation";
import { $createBlockNode } from "../Editor/decorators/BlockNode";
import { $createParagraphNode, $createTextNode } from "lexical";
import { useEditorContext } from "../../editor/react/EditorProvider";

export function TokenPrompt({
  prompt,
  replacePromptWithStream,
}: {
  prompt: string;
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const now = React.useMemo(() => new Date(), []);
  const date = React.useMemo(() => {
    return parseDateFromString(prompt, now);
  }, [prompt]);

  const generateDocumentId = useDocumentIdGenerator();

  const documentId = getDocumentId(useFieldId()) as DocumentId;

  const editor = useEditorContext();

  const options = [
    {
      id: "date",
      label: (
        <>
          Dato:{" "}
          {Intl.DateTimeFormat("da-DK", {
            weekday: "long",
          })
            .format(date)
            .slice(0, 3)}{" "}
          {serializeDate(date)}
        </>
      ),
      icon: CalendarDaysIcon,
      onEnter: React.useCallback(() => {
        replacePromptWithStream([{ date: date.toISOString() }]);
      }, [date, replacePromptWithStream]),
      match:
        prompt === "" ||
        date.getTime() !== parseDateFromString("", now).getTime(),
    },
    {
      label: "Oprettelsesdato",
      icon: CalendarDaysIcon,
      onEnter: React.useCallback(() => {
        const nestedField: NestedField = {
          id: generateDocumentId(documentId),
          field: createTemplateFieldId(
            documentId,
            DEFAULT_FIELDS.creation_date.id
          ),
        };
        replacePromptWithStream([nestedField]);
      }, [documentId, generateDocumentId, replacePromptWithStream]),
      match: "Oprettelsesdato".toLowerCase().includes(prompt.toLowerCase()),
    },
    {
      label: "Farve",
      icon: SwatchIcon,
      onEnter: React.useCallback(() => {
        replacePromptWithStream([true]);
      }, [replacePromptWithStream]),
      match: "Farve".toLowerCase().includes(prompt.toLowerCase()),
    },
    {
      label: "Checkboks",
      icon: CheckIcon,
      onEnter: React.useCallback(() => {
        replacePromptWithStream([true]);
      }, [replacePromptWithStream]),
      match:
        "Checkboks".toLowerCase().includes(prompt.toLowerCase()) ||
        prompt.toLowerCase() === "ja" ||
        prompt.toLowerCase() === "true" ||
        prompt.toLowerCase() === "nej" ||
        prompt.toLowerCase() === "false",
    },
  ];

  const filteredOptions = options.filter(({ match }) => match);

  return (
    <div className={cl("p-2.5", filteredOptions.length === 0 && "hidden")}>
      <div className="font-medium text-gray-400 mb-1 ml-1">Indsæt værdier</div>
      {filteredOptions.map(({ id, label, icon, onEnter }) => (
        <Option key={id ?? label} value="" onEnter={onEnter} Icon={icon}>
          {label}
        </Option>
      ))}
    </div>
  );

  /*
  const [isSelected, ref] = useOption();
  return (
    <div className="p-2.5">
      <div
        ref={ref}
        className={cl(
          "p-2.5 rounded",
          "group flex items-center gap-2",
          isSelected && "bg-gray-100 dark:bg-gray-800",
          "hover:ring-1 hover:ring-inset hover:ring-gray-200 dark:hover:ring-gray-700"
        )}
      >
        <div className="group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity cursor-default bg-gradient-to-b from-cyan-600 to-cyan-700 shadow-sm text-sky-100/90 rounded px-2 py-0.5 flex-center gap-2">
          <CalendarDaysIcon className="w-4 h-4 inline" />
          {Intl.DateTimeFormat("da-DK", {
            weekday: "long",
          })
            .format(date)
            .slice(0, 3)}{" "}
          {Intl.DateTimeFormat("da-DK", {
            dateStyle: "long",
            ...([date.getHours(), date.getMinutes(), date.getSeconds()].some(
              Boolean
            )
              ? { timeStyle: "short" }
              : {}),
          }).format(date)}
        </div>
        <div
          className="group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity cursor-default bg-gradient-to-b dark:bg-white shadow-sm text-black rounded px-2 py-0.5 flex-center gap-2"
          onMouseDown={(ev) => {
            ev.preventDefault();
          }}
          onClick={() => {
            replacePromptWithStream([{ color: "#ffffff" }]);
          }}
        >
          <SwatchIcon className="w-4 h-4 inline" />
          White
        </div>
        <div className="group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity cursor-default bg-gradient-to-b from-emerald-600 to-emerald-700 shadow-sm text-green-100/90 rounded px-2 py-0.5 flex-center gap-2">
          <CheckIcon className="w-4 h-4 inline" />
          Sand
        </div>
        <div className="group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity cursor-default bg-gradient-to-b from-pink-600 to-pink-700 shadow-sm text-red-100/90 rounded px-2 py-0.5 flex-center gap-2">
          <XMarkIcon className="w-4 h-4 inline" />
          Falsk
        </div>
      </div>
    </div>
  );
  */
}
