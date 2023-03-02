import * as React from "react";
import {
  Component,
  LayoutElement,
  RenderArray,
} from "@storyflow/frontend/types";
import { getLibraries } from "../config";
import { ParseRichText } from "./ParseRichText";

const getDefaultComponent = (type: string) => {
  // we use this only to get the default render components
  // Text, H1, H2, ...
  const libraries = getLibraries();
  let component: Component<any> | undefined;
  for (let i = 0; i < libraries.length; i++) {
    component = libraries[i].components[type] as Component<any> | undefined;
    if (component) break;
  }
  return component!;
};

const getComponentByType = (type: string) => {
  // the type property has been transformed by the server (traverse-async),
  // so that it parses to the true library with its matching key

  const [namespace, name] =
    type.indexOf(":") >= 0 ? type.split(":") : ["", type];
  const libraries = getLibraries();
  const filtered = libraries.filter((el) => el.name === namespace)!;
  let component: Component<any> | undefined;
  for (let i = 0; i < filtered.length; i++) {
    component = filtered[i].components[name] as Component<any> | undefined;
    if (component) break;
  }
  return component!;
};

const Component = ({
  data,
  children,
}: {
  data: RenderArray;
  children?: React.ReactNode;
}) => {
  return (
    <>
      {data.reduce((acc, d, index) => {
        const isChildArray = "$children" in d;
        const renderChildren = "$children" in d ? d.$children : [d];
        acc.push(
          ...renderChildren.map((d, childIndex) => {
            if ("type" in d && d.type === "Outlet") {
              return <React.Fragment key="Outlet">{children}</React.Fragment>;
            }
            if ("$heading" in d) {
              const Component = getDefaultComponent(`H${d.$heading[0]}`)!;
              const string = String(d.$heading[1]);
              return (
                <Component key={`${index}-${childIndex}`}>
                  <ParseRichText>{string}</ParseRichText>
                </Component>
              );
            }
            if ("$text" in d) {
              const Component = getDefaultComponent("Text")!;
              return (
                <Component key={`${index}-${childIndex}`}>
                  {d.$text.map((el, textElementIndex) => {
                    if (typeof el === "object") {
                      return (
                        <Element key={el.id} data={el} children={children} />
                      );
                    }
                    return (
                      <ParseRichText
                        key={`${index}-${childIndex}${textElementIndex}`}
                      >
                        {String(el)}
                      </ParseRichText>
                    );
                  })}
                </Component>
              );
            }
            return <Element key={d.id} data={d} children={children} />;
          })
        );

        return acc;
      }, [] as React.ReactNode[])}
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
  const CMSComponent = getComponentByType(data.type);
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

export const RenderPage = ({ data }: { data: any[] | undefined | null }) => (
  <Component data={data ?? []} />
);

export const RenderSingleLayout = ({
  data,
  children,
}: {
  data: any[] | undefined | null;
  children: React.ReactNode;
}) => {
  if (!data || data.length === 0) return <>{children}</>;
  return <Component data={data} children={children} />;
};
