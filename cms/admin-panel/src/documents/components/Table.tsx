import cl from "clsx";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useDragItem } from "@storyflow/dnd";
import { usePanel, useRoute } from "../../layout/panel-router/Routes";

export default function Table({
  labels,
  rows,
}: {
  labels?: string[];
  rows: {
    id: string;
    columns: { name?: string; value?: any; width?: string }[];
    indent?: number;
  }[];
}) {
  return (
    <table
      className={cl(
        "w-[calc(100%+1.25rem)] leading-none table-fixed -mx-2.5 -mb-2.5"
      )}
      border={0}
    >
      {labels && (
        <thead>
          <tr className="font-medium text-gray-600 dark:text-gray-300">
            <td className="w-9"></td>
            {labels.map((label) => (
              <td
                key={label}
                className="p-2.5 truncate"
                style={{ width: `calc(100% / ${labels.length})` }}
              >
                {label}
              </td>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map(({ id, columns, indent }, index) => (
          <Row key={id} id={id} columns={columns} indent={indent} />
        ))}
        {rows.length === 0 ? (
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
  id,
  columns,
  indent,
}: {
  id: string;
  columns: { name?: string; value?: any; width?: string }[];
  indent?: number;
}) {
  const [{ index: panelIndex }, navigate] = usePanel();
  const route = useRoute();

  const to = `${route}/d${parseInt(id, 16).toString(16)}`;

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
        <Checkbox id={id} />
      </td>
      {columns.map((el, index) => {
        return (
          <td
            key={index}
            className={cl("p-2.5 truncate")}
            style={{ width: el.width }}
          >
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
                <span>{el.value}</span>
              </div>
            ) : (
              el.value
            )}
          </td>
        );
      })}
    </tr>
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
