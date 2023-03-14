import React from "react";
import cl from "clsx";
import { FieldId } from "@storyflow/backend/types";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { addImport } from "../../custom-events";
import {
  createRawTemplateFieldId,
  createTemplateFieldId,
  getRawFieldId,
} from "@storyflow/backend/ids";
import { useFieldTemplate } from "./useFieldTemplate";
import { useFieldFocus } from "../../field-focus";

export function TemplateHeader({ id }: { id: FieldId }) {
  const [focused] = useFieldFocus();
  const isLink = focused && focused !== id;

  const template = useFieldTemplate(id);

  if (!template) return null;

  return (
    <div className="px-14">
      <div
        className={cl(
          "w-full flex divide-x divide-gray-200 dark:divide-gray-700 rounded mt-1 mb-2 py-0.5",
          "dark:text-gray-300",
          "text-sm",
          "ring-1 ring-gray-200 dark:ring-gray-700"
        )}
      >
        <div className="w-6 flex-center">
          <ChevronDownIcon className="w-3 h-3" />
        </div>
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
