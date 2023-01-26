import { LayoutElement, Library, ValueArray } from "@storyflow/frontend/types";
import React from "react";
import { getComponentByName } from "../config";

const C = ({
  data,
  children,
}: {
  data: ValueArray;
  children?: React.ReactNode;
}) => {
  return (
    <>
      {data.map((d) =>
        typeof d === "object" && "type" in d ? (
          d.type === "Outlet" ? (
            children
          ) : (
            <E key={d.id} data={d} children={children} />
          )
        ) : typeof d === "string" ? (
          <E
            key={`t-${d.substring(0, 25)}`}
            data={{ id: "text", type: "Text", props: { text: d } }}
          />
        ) : null
      )}
    </>
  );
};

/*
const c = (p: any, t: string) => (t === "children" ? <C data={p} /> : p[0]);

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
*/
const c = (value: any, children: React.ReactNode | undefined) =>
  typeof value === "object" && "$children" in value ? (
    <C data={value.$children} children={children} />
  ) : (
    value
  );

const E = ({
  data,
  children,
}: {
  data: LayoutElement;
  children?: React.ReactNode;
}) => {
  const Comp = getComponentByName(data.type);
  const props = React.useMemo(() => {
    return Object.fromEntries(
      Object.entries(data.props).map(([name, value]) => [
        name,
        c(value, children),
      ])
    );
  }, []);
  return <Comp {...props} />;
  /*
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
  */
};

export const RenderPage = ({ data }: { data: any[] }) => (
  <C data={data ?? []} />
);

export const RenderSingleLayout = ({
  data,
  children,
}: {
  data: any[];
  children: React.ReactNode;
}) => {
  if (!data || data.length === 0) return <>{children}</>;
  return <C data={data} children={children} />;
};

/*
export const RenderLayout = ({
  data,
  children,
}: {
  data: ({ layout: any | null } | null)[];
  children: React.ReactNode;
}) => {
  return (
    <>
      {!data
        ? children
        : data.reduce(
            (child, el) =>
              el?.layout?.length ? (
                <OutletProvider outlet={child}>
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
*/
