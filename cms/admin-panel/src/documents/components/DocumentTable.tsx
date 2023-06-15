import cl from "clsx";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useDragItem } from "@storyflow/dnd";
import { DBDocument } from "@storyflow/cms/types";
import { FieldId, RawFieldId } from "@storyflow/shared/types";
import { getPreview } from "../../fields/default/getPreview";
import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";
import { createTemplateFieldId } from "@storyflow/cms/ids";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { useDocumentLabel } from "../useDocumentLabel";
import { useTranslation } from "../../translation/TranslationContext";
import { useNavigate, useRoute } from "@nanokit/router";
import { TEMPLATE_FOLDER } from "@storyflow/cms/constants";
import { InlineButton } from "../../elements/InlineButton";

export default function Table({
  columns,
  documents,
  button,
}: {
  columns: {
    id: FieldId;
    label: string;
  }[];
  documents: (DBDocument & { indent?: number; label?: string })[];
  button?: {
    label: string;
    onClick: (doc: DBDocument) => void;
    icon: React.FC<{ className?: string }>;
  };
}) {
  const t = useTranslation();

  return (
    <table
      className={cl(
        "w-[calc(100%+1.25rem)] leading-none table-fixed -mx-2.5 -mb-2.5"
      )}
      border={0}
    >
      {columns && (
        <thead className="">
          <tr className="font-medium text-gray-600 dark:text-gray-300">
            <td className="w-9 hidden @sm:table-cell"></td>
            {columns.map(({ label }, index) => (
              <td
                key={label}
                className={cl(
                  "p-2.5 truncate",
                  index !== 0 && "hidden @sm:table-cell"
                )}
                style={{ width: `calc(100% / ${columns.length})` }}
              >
                {label}
              </td>
            ))}
            {button && <td className="w-11 @md:w-40"></td>}
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
            <td className="p-3 text-sm text-gray-400">
              {t.documents.noDocuments()}
            </td>
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
  const route = useRoute();
  const { index: panelIndex } = useRoute("parallel");
  const navigate = useNavigate();

  const type = route.accumulated.endsWith(
    `/${parseInt(TEMPLATE_FOLDER, 16).toString(16)}`
  )
    ? "t"
    : "d";
  const to = `${route.accumulated}/${type}/${parseInt(doc._id, 16).toString(
    16
  )}`;

  const { dragHandleProps } = useDragItem({
    type: `link:${panelIndex}`,
    item: to,
    mode: "link",
  });

  return (
    <tr
      className="border-t border-gray-100 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-850 transition-[background-color]"
      {...dragHandleProps}
      onClick={() => {
        navigate(to);
      }}
    >
      <td className="hidden @sm:table-cell w-9 text-[0px] border-0 p-0">
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
          <td
            key={index}
            className={cl(
              "p-2.5 truncate",
              index !== 0 && "hidden @sm:table-cell"
            )}
          >
            {index === 0 && indent ? (
              <div className="mr-3 flex items-center">
                <svg
                  viewBox="0 0 7 5"
                  strokeWidth={0.25}
                  stroke="currentColor"
                  fill="none"
                  className="h-5 w-7 shrink-0 opacity-25 mr-1.5"
                  style={{
                    marginLeft: `${(indent - 1) * 2}rem`,
                  }}
                >
                  <path
                    d="M 1 1.5 L 1 3 L 6 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {value}
              </div>
            ) : (
              value
            )}
          </td>
        );
      })}
      {button && (
        <td className={cl("p-2.5")}>
          <InlineButton
            icon={button.icon}
            onClick={(ev) => {
              ev.stopPropagation();
              button.onClick(doc);
            }}
            className="whitespace-nowrap"
          >
            <span className="hidden @md:inline">{button.label}</span>
          </InlineButton>
        </td>
      )}
    </tr>
  );
}

function LabelColumn({ doc }: { doc: DBDocument }) {
  const { label, isModified } = useDocumentLabel(doc);

  return (
    <div className="flex items-center">
      <span
        className={cl(
          "truncate -my-2.5 py-2.5",
          isModified && !doc.folder && "text-yellow-600 dark:text-yellow-200"
        )}
      >
        {label || "Unavngivet dokument"}
      </span>
      {isModified && (
        <div
          className={cl(
            "w-2 h-2 rounded ml-2",
            !doc.folder ? "bg-yellow-600 dark:bg-yellow-200" : "bg-teal-400"
          )}
        />
      )}
    </div>
  );
}

function Checkbox({ id }: { id: string }) {
  return (
    <label className="block p-2.5" onClick={(ev) => ev.stopPropagation()}>
      <div className="w-4 h-4 relative z-0 flex-center">
        <input name={id} type="checkbox" className="peer w-0 h-0 opacity-0" />
        <div className="absolute inset-0 -z-10 bg-gray-200 dark:bg-gray-750 peer-checked:bg-gray-500 rounded transition-colors" />
        <CheckIcon className="w-3 h-3 opacity-0 peer-checked:opacity-100 text-gray-200 transition-opacity" />
      </div>
    </label>
  );
}
