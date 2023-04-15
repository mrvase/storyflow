import cl from "clsx";
import { FieldId, GetFunctionData, Transform } from "@storyflow/backend/types";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  LinkIcon,
  ScissorsIcon,
} from "@heroicons/react/24/outline";
import { addImport } from "../../custom-events";
import {
  createRawTemplateFieldId,
  getDocumentId,
  getRawFieldId,
} from "@storyflow/backend/ids";
import { useFieldTemplate } from "./useFieldTemplate";
import { useFieldFocus } from "../../field-focus";
import { Checkbox } from "../../elements/Checkbox";
import { Range } from "../../elements/Range";
import { Menu } from "@headlessui/react";
import { MenuTransition } from "../../elements/transitions/MenuTransition";
import { useDocumentMutate } from "../../documents/collab/DocumentCollabContext";
import { FieldOperation } from "shared/operations";

export function TemplateHeader({
  id,
  transforms,
}: {
  id: FieldId;
  transforms: Transform[];
}) {
  const [focused] = useFieldFocus();
  const isLink = focused && focused !== id;

  const template = useFieldTemplate(id);

  if (!template) return null;

  return (
    <div
      className={cl(
        "w-full flex divide-x divide-gray-200 dark:divide-gray-700 rounded mt-1 mb-2.5 py-1",
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
                "w-8 h-full flex-center transition-opacity",
                open ? "opacity-100" : "opacity-50 hover:opacity-100"
              )}
            >
              {open ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </Menu.Button>
            <MenuTransition show={open} className="absolute z-10 mt-2">
              <Menu.Items
                static
                className="bg-button mt-1 rounded shadow flex flex-col outline-none overflow-hidden w-52 ring-1 ring-gray-600"
                data-focus-remain="true"
              >
                <TransformMenu id={id} transforms={transforms} />
              </Menu.Items>
            </MenuTransition>
          </div>
        )}
      </Menu>
      {(template ?? []).map(({ id: columnId, label }) => (
        <div
          key={columnId}
          className={cl(
            "group grow shrink basis-0 flex items-center gap-1 px-2"
          )}
        >
          <span
            className={cl("truncate", isLink && "cursor-alias")}
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
            {label}
          </span>
          {isLink && <LinkIcon className="w-3 h-3 opacity-50" />}
          {/*(
              <div className="w-6 h-6 flex-center ml-auto">
                <LinkIcon className="w-3 h-3 opacity-50 group-hover:opacity-100" />
              </div>
            )*/}
        </div>
      ))}
    </div>
  );
}

function TransformMenu({
  id,
  transforms,
}: {
  id: FieldId;
  transforms: Transform[];
}) {
  const fetchTransform = transforms.find((el) => el.type === "fetch");

  const { push } = useDocumentMutate<FieldOperation>(
    getDocumentId(id),
    getRawFieldId(id)
  );

  return (
    <div className="p-2 flex flex-col gap-2">
      <div className="text-xs">
        <Checkbox
          value={fetchTransform !== undefined}
          setValue={(value) => {
            push([
              id,
              [
                {
                  name: "fetch",
                  value: value ? ([50] as [number]) : null,
                },
              ],
            ]);
          }}
          label="Hent dokumenter fra mapper"
          small
        />
      </div>
      {fetchTransform !== undefined && (
        <>
          <div className="flex items-center gap-1.5 text-xs">
            <ScissorsIcon className="w-3 h-3" /> Begræns antal
          </div>
          <div className="py-1 pl-[1.175rem]">
            <Range
              value={(fetchTransform.data as GetFunctionData<"fetch">)[0]}
              setValue={(limit) => {
                const a: GetFunctionData<"fetch"> = {} as any;
                push([
                  id,
                  [
                    {
                      name: "fetch",
                      value: [limit] as [number],
                    },
                  ],
                ]);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
