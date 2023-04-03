import cl from "clsx";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useDragItem } from "@storyflow/dnd";
import { usePanel, useRoute } from "../../panel-router/Routes";

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
    <table className={cl("w-full leading-none font-light")} border={0}>
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
            <td className="w-[1%] p-3 text-[0px]">
              <div className="w-3" />
            </td>
            <td className="p-3 text-sm text-gray-500">Ingen elementer</td>
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
  const [, navigate] = usePanel();
  const route = useRoute();

  const { dragHandleProps, ref } = useDragItem<HTMLTableRowElement, string>({
    id,
    type: "article",
    item: id,
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
            className={cl("p-2.5 border-0", "w-full")}
            onClick={() => {
              navigate(`${route}/d${id}`, { navigate: true });
            }}
          >
            {}
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
    <label className="block p-2.5">
      <div className="w-4 h-4 relative z-0 flex-center">
        <input name={id} type="checkbox" className="peer w-0 h-0 opacity-0" />
        <div className="absolute inset-0 -z-10 bg-white dark:bg-gray-750 peer-checked:bg-gray-500 rounded transition-colors" />
        <CheckIcon className="w-3 h-3 opacity-0 peer-checked:opacity-100 text-gray-200 transition-opacity" />
      </div>
    </label>
  );
}
