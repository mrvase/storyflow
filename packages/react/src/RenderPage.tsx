import * as React from "react";
import { LayoutElement, ValueArray } from "@storyflow/frontend/types";
import { getComponentByName } from "../config";

const Component = ({
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
            <Element key={d.id} data={d} children={children} />
          )
        ) : typeof d === "string" && d !== "" ? (
          <Element
            key={`t-${d.substring(0, 25)}`}
            data={{ id: "text", type: "Text", props: { text: d } }}
          />
        ) : null
      )}
    </>
  );
};

const getPropValue = (value: any, children: React.ReactNode | undefined) =>
  typeof value === "object" && "$children" in value ? (
    <Component data={value.$children} children={children} />
  ) : (
    value
  );

const Element = ({
  data,
  children,
}: {
  data: LayoutElement;
  children?: React.ReactNode;
}) => {
  const CMSComponent = getComponentByName(data.type);
  const props = React.useMemo(() => {
    return Object.fromEntries(
      Object.entries(data.props).map(([name, value]) => [
        name,
        getPropValue(value, children),
      ])
    );
  }, []);
  return <CMSComponent {...props} />;
};

export const RenderPage = ({ data }: { data: any[] }) => (
  <Component data={data ?? []} />
);

export const RenderSingleLayout = ({
  data,
  children,
}: {
  data: any[];
  children: React.ReactNode;
}) => {
  if (!data || data.length === 0) return <>{children}</>;
  return <Component data={data} children={children} />;
};
