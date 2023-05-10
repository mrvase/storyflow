import cl from "clsx";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useDragItem } from "@storyflow/dnd";
import { usePanel, useRoute } from "../../layout/panel-router/Routes";
import { DBDocument } from "@storyflow/cms/types";
import { FieldId, RawFieldId } from "@storyflow/shared/types";
import { getPreview } from "../../fields/default/getPreview";
import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";
import { createTemplateFieldId } from "@storyflow/cms/ids";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { useDocumentLabel } from "../useDocumentLabel";

export default function Table({
  columns,
  documents,
  button,
}: {
  columns: {
    id: FieldId;
    label: string;
  }[];
  documents: (DBDocument & { indent?: number })[];
  button?: {
    label: string;
    onClick: (doc: DBDocument) => void;
    icon: React.FC<{ className?: string }>;
  };
}) {
  return (
    <table
      className={cl(
        "w-[calc(100%+1.25rem)] leading-none table-fixed -mx-2.5 -mb-2.5"
      )}
      border={0}
    >
      {columns && (
        <thead>
          <tr className="font-medium text-gray-600 dark:text-gray-300">
            <td className="w-9"></td>
            {columns.map(({ label }) => (
              <td
                key={label}
                className="p-2.5 truncate"
                style={{ width: `calc(100% / ${columns.length})` }}
              >
                {label}
              </td>
            ))}
            {button && <td className="w-40"></td>}
          </tr>
        </thead>
      )}
      <tbody>
        {documents.map((doc, index) => (
          <Row
            key={doc._id}
            columns={columns}
            doc={doc}
            indent={doc.indent}
            button={button}
          />
        ))}
        {documents.length === 0 ? (
          <tr className="border-t border-gray-100 dark:border-gray-800">
            <td className="w-9 p-3 text-[0px]">
              <div className="w-3" />
            </td>
            <td className="p-3 text-sm text-gray-400">Ingen elementer</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function Row({
  columns,
  doc,
  indent,
  button,
}: {
  columns: {
    id: FieldId;
    label: string;
  }[];
  doc: DBDocument & { indent?: number };
  indent?: number;
  button?: {
    label: string;
    onClick: (doc: DBDocument) => void;
    icon: React.FC<{ className?: string }>;
  };
}) {
  const [{ index: panelIndex }, navigate] = usePanel();
  const route = useRoute();

  const to = `${route}/d${parseInt(doc._id, 16).toString(16)}`;

  const { dragHandleProps } = useDragItem({
    type: `link:${panelIndex}`,
    item: to,
    mode: "link",
  });

  return (
    <tr
      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-[background-color]"
      {...dragHandleProps}
      onClick={() => {
        navigate(to, {
          navigate: true,
        });
      }}
    >
      <td className="w-9 text-[0px] border-0 p-0">
        <Checkbox id={doc._id} />
      </td>
      {columns.map(({ id }, index) => {
        const value =
          id === DEFAULT_FIELDS.label.id ? (
            <LabelColumn doc={doc} />
          ) : (
            getPreview(
              calculateRootFieldFromRecord(
                createTemplateFieldId(doc._id, id),
                doc.record
              )
            )
          );
        return (
          <td key={index} className={cl("p-2.5 truncate")}>
            {index === 0 && indent ? (
              <div className="mr-3 flex items-center">
                <svg
                  viewBox="0 0 8 5"
                  strokeWidth={0.25}
                  stroke="currentColor"
                  fill="none"
                  className="h-5 w-8 shrink-0 opacity-25 mr-2"
                  style={{
                    marginLeft: `${(indent - 1) * 2.5}rem`,
                  }}
                >
                  <path
                    d="M 1 1.5 L 1 3 L 7 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {value}
              </div>
            ) : (
              <div className="flex items-center">{value}</div>
            )}
          </td>
        );
      })}
      {button && (
        <td className={cl("p-2.5")}>
          <button
            className="ml-auto rounded px-2 py-0.5 text-sm text-gray-800 dark:text-white text-opacity-50 hover:text-opacity-100 dark:text-opacity-50 dark:hover:text-opacity-100 ring-button flex items-center gap-2 whitespace-nowrap"
            onClick={(ev) => {
              ev.stopPropagation();
              button.onClick(doc);
            }}
          >
            <button.icon className="w-3 h-3" /> {button.label}
          </button>
        </td>
      )}
    </tr>
  );
}

function LabelColumn({ doc }: { doc: DBDocument }) {
  const { label, isModified } = useDocumentLabel(doc);

  return (
    <>
      <span>{label}</span>
      {isModified && (
        <div
          className={cl(
            "w-2 h-2 rounded ml-2",
            !doc.folder ? "bg-yellow-400" : "bg-teal-400"
          )}
        />
      )}
    </>
  );
}

function Checkbox({ id }: { id: string }) {
  return (
    <label className="block p-2.5" onClick={(ev) => ev.stopPropagation()}>
      <div className="w-4 h-4 relative z-0 flex-center">
        <input name={id} type="checkbox" className="peer w-0 h-0 opacity-0" />
        <div className="absolute inset-0 -z-10 bg-white dark:bg-gray-750 peer-checked:bg-gray-500 rounded transition-colors" />
        <CheckIcon className="w-3 h-3 opacity-0 peer-checked:opacity-100 text-gray-200 transition-opacity" />
      </div>
    </label>
  );
}
