import { LayoutElement, ValueArray } from "@storyflow/frontend/types";
import React from "react";
import { getComponents } from "./ComponentRecord";
import { OutletProvider } from "./Outlet";

const c = (p: any, t: string) => (t === "children" ? <C data={p} /> : p[0]);

const C = ({ data }: { data: ValueArray }) => (
  <>
    {data.map((d) =>
      typeof d === "object" && "type" in d ? (
        <E key={d.id} data={d} />
      ) : typeof d === "string" ? (
        <E
          key={`t-${d.substring(0, 25)}`}
          data={{ id: "text", type: "Text", props: { text: [d] } }}
        />
      ) : null
    )}
  </>
);

const expand = (
  entries: [name: string, value: any[], type: string][]
): [name: string, value: any[], type: string][][] => {
  return Array.from(
    {
      length: Math.max(
        1,
        ...entries
          .filter((el) => el[2] !== "children")
          .map((el) => el[1].length)
      ),
    },
    (_, i) => {
      return entries.map(([name, value, type]) => [
        name,
        type === "children" ? value : [value[i % value.length]],
        type,
      ]);
    }
  );
};

const E = ({ data }: { data: LayoutElement }) => {
  const config = getComponents()[data.type];
  const comps = React.useMemo(() => {
    if (!config) return null;
    const expanded = expand(
      config.props.map(({ name: n, type: t }) => [n, data.props[n], t])
    );
    return expanded.map((props) =>
      Object.fromEntries(
        props.map(([name, value, type]) => [name, c(value, type)])
      )
    );
  }, []);
  if (!comps) return null;
  return (
    <>
      {comps.map((props) => (
        <config.component {...props} />
      ))}
    </>
  );
};

export const RenderPage = ({ data }: { data: any }) => (
  <C data={data?.[0]?.page ?? []} />
);

export const RenderLayout = ({
  data,
  children,
}: {
  data: ({ id: string; path: string; layout: any | null } | null)[];
  children: React.ReactElement;
}) => {
  return (
    <>
      {!data
        ? children
        : data.reduce(
            (child, el) =>
              el?.layout?.length ? (
                <OutletProvider outlet={child} path={el.path}>
                  <C data={el.layout} />
                </OutletProvider>
              ) : (
                child
              ),
            children
          )}
    </>
  );
};
