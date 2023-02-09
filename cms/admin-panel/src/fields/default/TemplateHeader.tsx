import React from "react";
import cl from "clsx";
import { DocumentId, FieldId } from "@storyflow/backend/types";
import { ChevronDownIcon, LinkIcon } from "@heroicons/react/24/outline";
import { addImport } from "../../custom-events";
import { getTemplateFieldId } from "@storyflow/backend/ids";
import { useFieldTemplate, useTemplate } from "./useFieldTemplate";

export function TemplateHeader(
  props: { id: FieldId } | { template: DocumentId }
) {
  const template =
    "template" in props
      ? useTemplate(props.template)
      : useFieldTemplate(props.id);

  console.log("TEMPLATE", props, template);

  if (!template) return null;

  return (
    <div className="px-14">
      <div
        className={cl(
          "w-full flex divide-x divide-sky-800 rounded mt-2 -mb-0.5",
          "dark:bg-gray-900 dark:text-sky-200",
          "text-sm",
          "ring-1 ring-sky-200 dark:ring-sky-800"
        )}
      >
        <div className="w-5 flex-center">
          <ChevronDownIcon className="w-3 h-3" />
        </div>
        {(template ?? []).map(({ id: columnId, label }) => (
          <div
            key={columnId}
            className="grow shrink basis-0 px-2 flex items-center justify-between"
          >
            <span className="truncate">{label}</span>
            <div
              onMouseDown={(ev) => {
                if ("id" in props) {
                  ev.preventDefault();
                  addImport.dispatch({
                    id: props.id,
                    templateId: getTemplateFieldId(columnId),
                    imports: [],
                  });
                }
              }}
            >
              <LinkIcon className="w-3 h-3 ml-auto opacity-50 hover:opacity-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
