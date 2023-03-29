import React from "react";
import cl from "clsx";
import { FieldId, Transform } from "@storyflow/backend/types";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ScissorsIcon,
} from "@heroicons/react/24/outline";
import { addImport } from "../../custom-events";
import { createRawTemplateFieldId } from "@storyflow/backend/ids";
import { useFieldTemplate } from "./useFieldTemplate";
import { useFieldFocus } from "../../field-focus";
import { useFieldConfig } from "../../documents/collab/hooks";
import { Checkbox } from "../../elements/Checkbox";
import { Range } from "../../elements/Range";
import { Menu } from "@headlessui/react";
import { MenuTransition } from "../../elements/transitions/MenuTransition";

export function TemplateHeader({
  id,
  setTransform,
}: {
  id: FieldId;
  setTransform: (transform: Transform | undefined) => void;
}) {
  const [focused] = useFieldFocus();
  const isLink = focused && focused !== id;

  const template = useFieldTemplate(id);

  if (!template) return null;

  return (
    <div className="pl-[2.875rem] pr-2.5">
      <div
        className={cl(
          "w-full flex divide-x divide-gray-200 dark:divide-gray-700 rounded mt-1 mb-2 py-0.5",
          "dark:text-gray-300",
          "text-sm",
          "ring-1 ring-gray-200 dark:ring-gray-700"
        )}
      >
        <Menu>
          {({ open }) => (
            <div className="relative">
              <Menu.Button
                as="button"
                className={cl(
                  "w-6 h-6 flex-center transition-opacity",
                  open ? "opacity-100" : "opacity-50 hover:opacity-100"
                )}
              >
                {open ? (
                  <ChevronUpIcon className="w-3 h-3" />
                ) : (
                  <ChevronDownIcon className="w-3 h-3" />
                )}
              </Menu.Button>
              <MenuTransition show={open} className="absolute z-10 mt-2">
                <Menu.Items
                  static
                  className="bg-button mt-1 rounded shadow flex flex-col outline-none overflow-hidden w-52 ring-1 ring-gray-600"
                  data-focus-remain="true"
                >
                  <TransformMenu id={id} setTransform={setTransform} />
                </Menu.Items>
              </MenuTransition>
            </div>
          )}
        </Menu>
        {(template ?? []).map(({ id: columnId, label }) => (
          <div
            key={columnId}
            className={cl(
              "group grow shrink basis-0 flex items-center justify-between",
              isLink && "cursor-alias"
            )}
            onMouseDown={(ev) => {
              if (isLink) {
                ev.preventDefault();
                addImport.dispatch({
                  id,
                  templateId: createRawTemplateFieldId(columnId),
                  imports: [],
                });
              }
            }}
          >
            <span className="truncate px-2">{label}</span>
            {/*(
              <div className="w-6 h-6 flex-center ml-auto">
                <LinkIcon className="w-3 h-3 opacity-50 group-hover:opacity-100" />
              </div>
            )*/}
          </div>
        ))}
      </div>
    </div>
  );
}

function TransformMenu({
  id,
  setTransform,
}: {
  id: FieldId;
  setTransform: (transform: Transform | undefined) => void;
}) {
  const [config, setConfig] = useFieldConfig(id);
  return (
    <div className="p-2 flex flex-col gap-2">
      <div className="text-xs">
        <Checkbox
          value={config?.transform?.type === "sortlimit"}
          setValue={(value) => {
            const transform = value
              ? ({ type: "sortlimit", data: { limit: 10 } } as const)
              : undefined;
            setConfig("transform", transform);
            setTransform(transform);
          }}
          label="Hent dokumenter fra mapper"
          small
        />
      </div>
      {config?.transform?.type === "sortlimit" && (
        <>
          <div className="flex items-center gap-1.5 text-xs">
            <ScissorsIcon className="w-3 h-3" /> Begræns antal
          </div>
          <div className="py-1 pl-[1.175rem]">
            <Range
              value={config.transform.data!.limit}
              setValue={(limit) => {
                const transform = {
                  type: "sortlimit",
                  data: { limit },
                } as const;
                setConfig("transform", transform);
                setTransform(transform);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
