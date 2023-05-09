import { createRenderArray } from "@storyflow/client/render";
import {
  ClientSyntaxTree,
  Component,
  ConfigRecord,
  FileToken,
  Library,
  LibraryConfig,
  LibraryConfigRecord,
  LibraryRecord,
  PropConfig,
  PropConfigRecord,
  ValueArray,
} from "@storyflow/shared/types";
import React from "react";
import { getConfigByType } from "../config/getConfigByType";
import { ParseRichText } from "../src/ParseRichText";
import { extendPath } from "../utils/extendPath";
import { getDefaultComponent } from "../utils/getDefaultComponent";
import { getIdFromString } from "@storyflow/shared/getIdFromString";
import { calculateClient } from "@storyflow/client/calculate-client";
import { defaultLibrary } from "../config/defaultLibrary";
import { defaultLibraryConfig } from "@storyflow/shared/defaultLibraryConfig";

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
  prop: ValueArray | ClientSyntaxTree,
  loopCtx: Record<string, number>,
  transforms: {
    children: (
      value: ValueArray | undefined,
      options?: ConfigRecord
    ) => React.ReactElement;
    file?: (value: FileToken | undefined) => any;
  }
) => {
  const type = config.type;

  const array: ValueArray = (() => {
    const isStateful = !Array.isArray(prop);

    if (isStateful) {
      return calculateClient(
        prop,
        (token) => {
          if ("state" in token) {
            return 0;
          }
          return 0;
        },
        (id) => loopCtx[id]
      );
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

  if (["image", "video"].includes(type)) {
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
    return transforms.children(
      children,
      config.options as ConfigRecord | undefined
    );
  }

  return value;
};

const RenderChildren = ({
  value,
  record,
  options,
  ctx,
}: {
  value: ValueArray;
  record: Record<string, ValueArray | ClientSyntaxTree>;
  options?: ConfigRecord;
  ctx: {
    index: number;
    spread: boolean;
    loop: Record<string, number>;
    configs: Record<string, LibraryConfig>;
    libraries: Record<string, Library>;
    children?: React.ReactNode;
  };
}) => {
  const libraries = ctx.libraries;
  const configs = ctx.configs;

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
    return Boolean(getConfigByType(type, { configs })?.config?.inline);
  };

  const renderArray = createRenderArray(value, getDisplayType);

  console.log("RENDER", value, renderArray);

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
                          key={`${arrayIndex}-${childIndex}-${textElementIndex}`}
                          id={el.id}
                          type={el.element}
                          record={record}
                          options={options}
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
                key={`${arrayIndex}-${childIndex}`}
                id={block.id}
                type={block.element}
                record={record}
                options={options}
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
  options,
  ctx,
}: {
  id: string;
  record: Record<string, ValueArray | ClientSyntaxTree>;
  type: string;
  options?: ConfigRecord;
  ctx: {
    index: number;
    spread: boolean;
    loop: Record<string, number>;
    configs: Record<string, LibraryConfig>;
    libraries: Record<string, Library>;
    children?: React.ReactNode;
  };
}) => {
  let { config, component } = getConfigByType(type, {
    configs: ctx.configs,
    libraries: ctx.libraries,
    options,
  });

  console.log("RENDER ELEMENT", id, type, options, config, component);

  if (!config || !component) return null;

  let props = {
    props: config.props,
    component,
    record,
    elementId: id,
  };

  if (type === "Loop") {
    const rawDocumentId = id.slice(12, 24);
    const dataId = `${rawDocumentId}${getIdFromString("data")}`;

    return (
      <>
        {(record[dataId] as ValueArray).map((_, newIndex) => {
          const loopCtx = {
            ...ctx.loop,
            [rawDocumentId]: newIndex,
          };
          return (
            <RenderElementWithProps
              key={newIndex}
              loopCtx={loopCtx}
              {...props}
              renderChildren={(
                value: ValueArray | undefined,
                options?: ConfigRecord
              ) => {
                return (
                  <RenderChildren
                    value={value ?? []}
                    record={record}
                    options={options}
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
      renderChildren={(
        value: ValueArray | undefined,
        options?: ConfigRecord
      ) => {
        return (
          <RenderChildren
            value={value ?? []}
            record={record}
            ctx={ctx}
            options={options}
          />
        );
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
  props,
  component: Component,
  renderChildren,
}: {
  elementId: string;
  record: Record<string, ValueArray | ClientSyntaxTree>;
  loopCtx: Record<string, number>;
  props: PropConfigRecord;
  component: Component<PropConfigRecord>;
  renderChildren: (value: ValueArray | undefined) => React.ReactElement;
}) {
  console.log("RESOLVE", elementId, props);

  const resolveProps = (props: PropConfigRecord, group?: string) => {
    return Object.fromEntries(
      Object.entries(props).map(([name, config]): [string, any] => {
        if (config.type === "group") {
          return [name, resolveProps(config.props, name)];
        }

        const key = extendPath(group ?? "", name, "#");

        const id = `${elementId.slice(12, 24)}${getIdFromString(key)}`;

        const transforms = {
          children: renderChildren,
          file: fileTransform,
        };

        return [
          name,
          normalizeProp(config, record[id] ?? [], loopCtx, transforms),
        ];
      })
    );
  };

  const resolvedProps = resolveProps(props);

  return <Component {...resolvedProps} />;
}

export const RenderPage = <T extends LibraryConfigRecord>({
  data,
  configs: configsFromProps,
  libraries: librariesFromProps,
}: {
  data:
    | {
        entry: ValueArray | ClientSyntaxTree;
        record: Record<string, ValueArray | ClientSyntaxTree>;
      }
    | null
    | undefined;
  configs: T;
  libraries: LibraryRecord<T>;
}) => {
  const libraries = { "": defaultLibrary, ...librariesFromProps };

  const configs = {
    "": defaultLibraryConfig,
    ...configsFromProps,
  };

  return data ? (
    <RenderChildren
      value={data.entry as ValueArray}
      record={data.record}
      ctx={{
        index: 0,
        spread: false,
        loop: {},
        children: undefined,
        configs,
        libraries,
      }}
    />
  ) : null;
};
export const RenderLayout = <T extends LibraryConfigRecord>({
  data,
  children,
  configs: configsFromProps,
  libraries: librariesFromProps,
}: {
  data:
    | {
        entry: ValueArray | ClientSyntaxTree;
        record: Record<string, ValueArray | ClientSyntaxTree>;
      }
    | null
    | undefined;
  children: React.ReactNode;
  configs: T;
  libraries: LibraryRecord<T>;
}) => {
  const libraries = { "": defaultLibrary, ...librariesFromProps };

  const configs = {
    "": defaultLibraryConfig,
    ...configsFromProps,
  };

  return data ? (
    <RenderChildren
      value={data.entry as ValueArray}
      record={data.record}
      ctx={{
        index: 0,
        spread: false,
        loop: {},
        children,
        configs,
        libraries,
      }}
    />
  ) : (
    <>{children}</>
  );
};
