import React from "react";
import cl from "clsx";
import { useTabUrl } from "../../layout/utils";
import { useSegment } from "../../layout/components/SegmentContext";
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { useDragItem } from "@storyflow/dnd";
import { minimizeId } from "@storyflow/backend/ids";
import { useFieldFocus } from "../../field-focus";
import { addDocumentImport } from "../../custom-events";
import { useCurrentFolder } from "../../folders/FolderPage";
import { DocumentId } from "@storyflow/backend/types";

export default function Table({
  rows,
}: {
  rows: {
    id: string;
    columns: { name?: string; value?: any }[];
    indent?: number;
  }[];
}) {
  return (
    <table
      className={cl(
        "w-full leading-none font-light -mx-2.5",
        rows.length === 0 && "opacity-50"
      )}
      border={0}
    >
      <thead>
        <tr className="font-normal">
          <td className=""></td>
          <td className="p-2.5">Navn</td>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ id, columns, indent }, index) => (
          <Row key={id} id={id} columns={columns} indent={indent} />
        ))}
        {rows.length === 0 ? (
          <tr className="border-t border-gray-100 dark:border-gray-800">
            <td className="w-8 p-3 text-[0px]">
              <input type="checkbox" className="w-4 h-4 invisible" />
            </td>
            <td className="p-3">Ingen elementer</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function Row({
  id,
  columns,
  indent,
}: {
  id: string;
  columns: { name?: string; value?: any }[];
  indent?: number;
}) {
  const [, navigateTab] = useTabUrl();

  const { current } = useSegment();

  const { dragHandleProps, ref } = useDragItem<HTMLTableRowElement, string>({
    id,
    type: "article",
    item: minimizeId(id),
    mode: "link",
  });

  return (
    <tr
      ref={ref}
      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-[background-color]"
      {...dragHandleProps}
    >
      <td className="w-[1%] text-[0px] border-0 p-0">
        <Checkbox id={id} />
      </td>
      {columns.map((el, index) => {
        return (
          <td
            key={index}
            className={cl(
              "p-2.5 border-0",
              typeof el.value !== "string" ? "w-[1%]" : "w-full"
            )}
            onClick={() => {
              navigateTab(`${current}/d-${id}`);
            }}
          >
            {index === 0 && indent ? (
              <span className="opacity-50 text-xs mr-3 align-middle">
                {Array.from({ length: indent }, (_, x) => (
                  <>- - - - </>
                ))}
              </span>
            ) : null}
            {el.value}
          </td>
        );
      })}
      {/*
      <td className="w-10">
        <button
          onMouseDown={(ev) => {
            ev.stopPropagation(); // block select of tab
            ev.preventDefault();
          }}
          onClick={(ev) => {
            ev.stopPropagation();
            navigateTab(
              `/~${parseInt(current.slice(2, 4), 10) + 1}/${current.slice(
                4
              )}/d-${id}`
            );
          }}
          className="w-10 h-10 flex-center hover:bg-gray-100 transition-colors"
        >
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
        </button>
      </td>
        */}
    </tr>
  );
}

function Checkbox({ id }: { id: string }) {
  const [focused] = useFieldFocus();

  const folder = useCurrentFolder();

  if (focused) {
    return (
      <button
        className="p-2.5"
        onMouseDown={(ev) => {
          ev.preventDefault();
          addDocumentImport.dispatch({
            documentId: minimizeId(id) as DocumentId,
            templateId: folder?.template,
          });
        }}
      >
        <LinkIcon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <label className="block p-2.5">
      <div className="w-4 h-4 relative z-0 flex-center">
        <input
          name={minimizeId(id)}
          type="checkbox"
          className="peer w-0 h-0 bg-transparent"
        />
        <div className="absolute inset-0 -z-10 bg-white dark:bg-gray-750 peer-checked:bg-gray-500 rounded transition-colors" />
        <CheckIcon className="w-3 h-3 opacity-0 peer-checked:opacity-100 text-gray-200 transition-opacity" />
      </div>
    </label>
  );
}
