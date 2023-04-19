import { createRenderArray } from "@storyflow/frontend/render";
import {
  FileToken,
  PropConfig,
  PropConfigArray,
  ValueArray,
} from "@storyflow/frontend/types";
import React from "react";
import { getLibraries, getLibraryConfigs } from "../config";
import {
  ExtendedComponentConfig,
  getConfigByType,
} from "../config/getConfigByType";
import { ParseRichText } from "../src/ParseRichText";
import { extendPath } from "../utils/extendPath";
import { getDefaultComponent } from "../utils/getDefaultComponent";
import { getIdFromString } from "../utils/getIdFromString";
import { calculateClient } from "../utils/clientCalculate";

const getImageObject = (name: string, url: string) => {
  const src = `${url}/${name}`;

  const width = name ? parseInt(name.split("-")[4] ?? "0", 16) : 0;
  const height = name ? parseInt(name.split("-")[5] ?? "0", 16) : 0;

  return {
    src,
    width,
    height,
  };
};

const normalizeProp = (
  config: PropConfig,
  prop: ValueArray,
  loopCtx: Record<string, any>,
  transforms: {
    children: (value: ValueArray | undefined) => React.ReactElement;
    file?: (value: FileToken | undefined) => any;
  }
) => {
  const type = config.type;

  const array: ValueArray = (() => {
    const isStateful = !Array.isArray(prop);

    if (isStateful) {
      return calculateClient(prop, (token) => {
        if ("loop" in token) {
          const elementId = token.loop.slice(0, 12);
          return (token as any).values[loopCtx[elementId]];
        }
      });
    }
    return prop;
  })();

  const value = array[0];

  if (value !== null && typeof value === "object" && "name" in value) {
    const option = Array.isArray(config.options)
      ? config.options.find(
          (el): el is { value: any } | { name: any } =>
            typeof el === "object" && el.name === value.name
        )
      : undefined;
    if (option && "value" in option) return option.value;
  }

  if (value !== null && typeof value === "object" && "color" in value) {
    return value.color;
  }

  if (["image", "video"].includes(type) && prop.length > 0) {
    return (
      transforms.file?.(value as FileToken | undefined) ??
      (value as FileToken | undefined)?.src ??
      ""
    );
  } else if (type === "boolean") {
    return value === "false" ? false : Boolean(value);
  } else if (type === "number") {
    return Number(value || 0);
  } else if (type === "string") {
    return String(value || "");
  } else if (type === "children") {
    const children = Array.isArray(value) ? value : array;
    return transforms.children(children);
  }

  return value;
};

const RenderChildren = ({
  value,
  record,
  ctx,
}: {
  value: ValueArray;
  record: Record<string, ValueArray>;
  ctx: {
    index: number;
    spread: boolean;
    loop: Record<string, number>;
    children?: React.ReactNode;
  };
}) => {
  const libraries = getLibraries();
  const configs = getLibraryConfigs();

  /*
  let array: ValueArray = [];
  if (ctx.spread) {
    const valueAtIndex = value[ctx.index];
    array = Array.isArray(valueAtIndex) ? valueAtIndex : [valueAtIndex];
  } else if (value.length === 1 && Array.isArray(value[0])) {
    array = value[0];
  } else {
    array = value;
  }
  */

  const getDisplayType = (type: string) => {
    return Boolean(getConfigByType(type, configs)?.inline);
  };

  const renderArray = createRenderArray(value, getDisplayType);

  return (
    <>
      {renderArray.reduce((acc, block, arrayIndex) => {
        const renderChildren = "$children" in block ? block.$children : [block];

        acc.push(
          ...renderChildren.map((block, childIndex) => {
            if ("element" in block && block.element === "Outlet") {
              return (
                <React.Fragment key="Outlet">{ctx.children}</React.Fragment>
              );
            }
            if ("$heading" in block) {
              const type = `H${block.$heading[0]}`;
              const Component = getDefaultComponent(type, libraries)!;
              const string = String(block.$heading[1]);
              return (
                <Component key={`${arrayIndex}-${childIndex}`}>
                  <ParseRichText>{string}</ParseRichText>
                </Component>
              );
            }
            if ("$text" in block) {
              const type = "Text";
              const Component = getDefaultComponent(type, libraries)!;
              return (
                <Component key={`${arrayIndex}-${childIndex}`}>
                  {block.$text.map((el, textElementIndex) => {
                    if (typeof el === "object") {
                      return (
                        <RenderElement
                          id={el.id}
                          type={el.element}
                          record={record}
                          ctx={{
                            ...ctx,
                            index: 0,
                          }}
                        />
                      );
                    }
                    return (
                      <ParseRichText
                        key={`${arrayIndex}-${childIndex}-${textElementIndex}`}
                      >
                        {String(el)}
                      </ParseRichText>
                    );
                  })}
                </Component>
              );
            }
            return (
              <RenderElement
                id={block.id}
                type={block.element}
                record={record}
                ctx={{
                  ...ctx,
                  index: 0,
                }}
              />
            );
          })
        );

        return acc;
      }, [] as React.ReactNode[])}
    </>
  );
};

const RenderElement = ({
  id,
  record,
  type,
  ctx,
}: {
  id: string;
  record: Record<string, ValueArray>;
  type: string;
  ctx: {
    index: number;
    spread: boolean;
    loop: Record<string, number>;
    children?: React.ReactNode;
  };
}) => {
  let config = getConfigByType(type, getLibraryConfigs(), getLibraries());
  if (!config) return null;

  let props = {
    config,
    record,
    elementId: id,
  };

  if (type === "Loop") {
    const rawDocumentId = id.slice(12, 24);
    const dataId = `${rawDocumentId}${getIdFromString("data")}`;

    return (
      <>
        {record[dataId].map((_, newIndex) => {
          const loopCtx = {
            ...ctx.loop,
            [rawDocumentId]: newIndex,
          };
          return (
            <RenderElementWithProps
              key={newIndex}
              loopCtx={loopCtx}
              {...props}
              renderChildren={(value: ValueArray | undefined) => {
                return (
                  <RenderChildren
                    value={value ?? []}
                    record={record}
                    ctx={{
                      ...ctx,
                      spread: true,
                      index: newIndex,
                      loop: loopCtx,
                    }}
                  />
                );
              }}
            />
          );
        })}
      </>
    );
  }

  return (
    <RenderElementWithProps
      loopCtx={ctx.loop}
      {...props}
      renderChildren={(value: ValueArray | undefined) => {
        return <RenderChildren value={value ?? []} record={record} ctx={ctx} />;
      }}
    />
  );
};

const fileTransform = (value: FileToken | undefined) => {
  if (!value)
    return {
      src: "",
      width: 0,
      height: 0,
    };
  return getImageObject(value.src, process.env.IMAGE_URL ?? "");
};

function RenderElementWithProps({
  elementId,
  record,
  loopCtx,
  config,
  renderChildren,
}: {
  elementId: string;
  record: Record<string, ValueArray>;
  loopCtx: Record<string, number>;
  config: ExtendedComponentConfig;
  renderChildren: (value: ValueArray | undefined) => React.ReactElement;
}) {
  const resolveProps = (props: PropConfigArray, group?: string) => {
    return Object.fromEntries(
      props.map((config): [string, any] => {
        const key = extendPath(group ?? "", config.name, "#");
        const id = `${elementId.slice(12, 24)}${getIdFromString(key)}`;

        if (config.type === "group") {
          return [config.name, resolveProps(config.props, config.name)];
        }

        const transforms = {
          children: renderChildren,
          file: fileTransform,
        };

        return [
          config.name,
          normalizeProp(config, record[id] ?? [], loopCtx, transforms),
        ];
      })
    );
  };

  const props = resolveProps(config.props);

  return <config.component {...props} />;
}

export const RenderPage = ({
  data,
}: {
  data:
    | {
        entry: ValueArray;
        record: Record<string, ValueArray>;
      }
    | null
    | undefined;
}) =>
  data ? (
    <RenderChildren
      value={data.entry}
      record={data.record}
      ctx={{
        index: 0,
        spread: false,
        loop: {},
        children: undefined,
      }}
    />
  ) : null;

export const RenderLayout = ({
  data,
  children,
}: {
  data:
    | {
        entry: ValueArray;
        record: Record<string, ValueArray>;
      }
    | null
    | undefined;
  children: React.ReactNode;
}) => {
  return data ? (
    <RenderChildren
      value={data.entry}
      record={data.record}
      ctx={{
        index: 0,
        spread: false,
        loop: {},
        children,
      }}
    />
  ) : (
    <>{children}</>
  );
};
