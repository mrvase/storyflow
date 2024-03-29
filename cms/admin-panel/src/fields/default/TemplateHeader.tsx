import cl from "clsx";
import type {
  DocumentId,
  FieldId,
  RawDocumentId,
  RawFieldId,
} from "@storyflow/shared/types";
import type { GetFunctionData, FieldTransform } from "@storyflow/cms/types";
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
  getRawDocumentId,
  getRawFieldId,
} from "@storyflow/cms/ids";
import { useTemplate } from "./useFieldTemplate";
import { useFieldFocus } from "../../FieldFocusContext";
import { Checkbox } from "../../elements/Checkbox";
import { Range } from "../../elements/Range";
import { Menu as HeadlessMenu } from "@headlessui/react";
import { usePush } from "../../collab/CollabContext";
import { useFieldId } from "../FieldIdContext";
import { Menu } from "../../elements/Menu";
import { useTemplateFolder } from "../../folders/FoldersContext";
import React from "react";
import { useDocumentList } from "../../documents";
import { useFieldTemplateId } from "./FieldTemplateContext";
import { FieldTransactionEntry } from "../../operations/actions";
import { createTransaction } from "@storyflow/collab/utils";
import { getDocumentLabel } from "../../documents/useDocumentLabel";
import { useTranslation } from "../../translation/TranslationContext";

export function TemplateHeader({
  id,
  transforms,
  isNested,
}: {
  id: FieldId;
  transforms: FieldTransform[];
  isNested?: boolean;
}) {
  const [focused] = useFieldFocus();
  const isLink = !isNested && focused && focused !== id;

  let templateId = useFieldTemplateId();
  const template = useTemplate(templateId);

  if (!template && !isNested) return null;

  return (
    <div className="">
      <div
        className={cl(
          "w-full flex divide-x divide-gray-200 dark:divide-gray-700 rounded mt-1 mb-2.5 py-1",
          "dark:text-gray-300",
          "text-sm",
          "ring-1 ring-gray-200 dark:ring-gray-700"
        )}
      >
        <HeadlessMenu>
          {({ open }) => (
            <div className="relative">
              <HeadlessMenu.Button
                as="button"
                className={cl(
                  "h-full flex-center transition-opacity px-3.5 gap-2",
                  open ? "opacity-100" : "opacity-50 hover:opacity-100"
                )}
              >
                {open ? (
                  <ChevronUpIcon className="w-4 h-4" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4" />
                )}
                {!template && "Vælg skabelon"}
              </HeadlessMenu.Button>
              <Menu.Items align="left" open={open} marginTop="mt-2">
                <TransformMenu id={id} transforms={transforms} />
                {isNested && <TemplateMenu id={id} transforms={transforms} />}
              </Menu.Items>
            </div>
          )}
        </HeadlessMenu>
        {(template ?? []).map(({ id: columnId, label }) => (
          <div
            key={columnId}
            className={cl(
              "group grow shrink basis-0 flex items-center gap-1 px-2 overflow-hidden"
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
            {isLink ? (
              <LinkIcon className="w-3 h-3 opacity-50" />
            ) : (
              <SortButton
                id={id}
                transforms={transforms}
                rawFieldId={createRawTemplateFieldId(columnId)}
              />
            )}
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

function SortButton({
  id,
  transforms,
  rawFieldId,
}: {
  id: FieldId;
  transforms: FieldTransform[];
  rawFieldId: RawFieldId;
}) {
  const rootId = useFieldId();

  const currentFetch = transforms.find(
    (el): el is FieldTransform<"fetch"> => el.type === "fetch"
  );

  const sorting = currentFetch ? currentFetch.data[1] : undefined;
  const sortingId = sorting?.slice(1) as RawFieldId | undefined;
  const direction = sorting?.slice(0, 1) as "+" | "-" | undefined;

  const isCurrent = sortingId === rawFieldId;

  const push = usePush<FieldTransactionEntry>(
    getDocumentId<DocumentId>(rootId),
    getRawFieldId(rootId)
  );

  const Icon = isCurrent && direction === "-" ? ChevronUpIcon : ChevronDownIcon;

  return (
    <Icon
      className={cl(
        "shrink-0 w-3 h-3",
        sortingId === rawFieldId
          ? "opacity-100 ring-1 rounded-full ring-gray-400"
          : "opacity-25"
      )}
      onClick={() => {
        if (currentFetch) {
          const nextDirection = isCurrent && direction === "+" ? "-" : "+";
          push(
            createTransaction((t) =>
              t.target(id).toggle({
                name: "fetch",
                value: [currentFetch.data[0], `${nextDirection}${rawFieldId}`],
              })
            )
          );
        }
      }}
    />
  );
}

function TransformMenu({
  id,
  transforms,
}: {
  id: FieldId;
  transforms: FieldTransform[];
}) {
  const rootId = useFieldId();

  const current = transforms.find(
    (el): el is FieldTransform<"fetch"> => el.type === "fetch"
  );

  const push = usePush<FieldTransactionEntry>(
    getDocumentId<DocumentId>(rootId),
    getRawFieldId(rootId)
  );

  return (
    <div className="p-2 flex flex-col gap-2">
      <div className="text-xs">
        <Checkbox
          value={current !== undefined}
          setValue={(value) => {
            push(
              createTransaction((t) =>
                t.target(id).toggle({
                  name: "fetch",
                  value: value ? [50] : null,
                })
              )
            );
          }}
          label="Hent dokumenter fra mapper"
          small
        />
      </div>
      {current !== undefined && (
        <>
          <div className="flex items-center gap-1.5 text-xs">
            <ScissorsIcon className="w-3 h-3" /> Begræns antal
          </div>
          <div className="py-1 pl-[1.175rem]">
            <Range
              value={current.data[0]}
              setValue={(limit) => {
                push(
                  createTransaction((t) =>
                    t.target(id).toggle({
                      name: "fetch",
                      value: [limit],
                    })
                  )
                );
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function TemplateMenu({
  id,
  transforms,
}: {
  id: FieldId;
  transforms: FieldTransform[];
}) {
  const t = useTranslation();
  const rootId = useFieldId();

  const push = usePush<FieldTransactionEntry>(
    getDocumentId<DocumentId>(rootId),
    getRawFieldId(rootId)
  );

  const templateFolder = useTemplateFolder()?._id;
  const { documents: templates } = useDocumentList(templateFolder);

  const options = React.useMemo(
    () =>
      (templates ?? [])
        .filter((el) => el.folder)
        .map((el) => ({
          id: el._id,
          label: getDocumentLabel(el, t),
        })),
    [templates]
  );

  const current = transforms.find(
    (el): el is FieldTransform<"template"> => el.type === "template"
  )?.data;

  return (
    <>
      {current && (
        <Menu.Item
          onClick={() => {
            push(
              createTransaction((t) =>
                t.target(id).toggle({
                  name: "template",
                  value: null,
                })
              )
            );
          }}
          label={t.documents.removeTemplate()}
        />
      )}
      {options.map((el) => (
        <Menu.Item
          key={el.label}
          // selected={current === getRawDocumentId(el.id)}
          onClick={(ev) => {
            push(
              createTransaction((t) =>
                t.target(id).toggle({
                  name: "template",
                  value: getRawDocumentId(el.id),
                })
              )
            );
          }}
          label={el.label}
        />
      ))}
    </>
  );
}
