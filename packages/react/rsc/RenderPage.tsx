import { createRenderArray } from "@storyflow/client/render";
import {
  ClientSyntaxTree,
  Component,
  Config,
  ConfigRecord,
  FileToken,
  Library,
  LibraryConfig,
  LibraryConfigRecord,
  LibraryRecord,
  NestedDocumentId,
  PropConfig,
  PropConfigRecord,
  ValueArray,
} from "@storyflow/shared/types";
import React from "react";
import { getConfigByType } from "../src/getConfigByType";
import { ParseRichText } from "../src/ParseRichText";
import { extendPath } from "../utils/extendPath";
import { getDefaultComponent } from "../src/getDefaultComponent";
import { getIdFromString } from "@storyflow/shared/getIdFromString";
import { calculateClient } from "@storyflow/client/calculate-client";
import { defaultLibrary } from "../src/defaultLibrary";
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

type ComponentContext = {
  element: symbol;
  index: number;
  context?: Record<string, any>;
};

type RSCContext = {
  spread: boolean;
  loop: Record<string, number>;
  configs: Record<string, LibraryConfig>;
  libraries: Record<string, Library>;
  children?: React.ReactNode;
  contexts: ComponentContext[];
};

const resolveStatefulProp = (
  prop: ValueArray | ClientSyntaxTree,
  loopCtx: Record<string, number>
) => {
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
};

const normalizeProp = (
  config: PropConfig,
  prop: ValueArray,
  transforms: {
    file?: (value: FileToken | undefined) => any;
  }
) => {
  const type = config.type;
  const value = prop[0];

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
  ctx: RSCContext;
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

  return (
    <>
      {renderArray.reduce((acc, block, arrayIndex) => {
        const renderChildren = "$children" in block ? block.$children : [block];

        let blockIndex = 0;

        acc.push(
          ...renderChildren.map((block, childIndex) => {
            if ("element" in block && block.element === "Outlet") {
              blockIndex++;
              return (
                <React.Fragment key="Outlet">{ctx.children}</React.Fragment>
              );
            } else if ("$heading" in block) {
              blockIndex++;
              const type = `H${block.$heading[0]}`;
              const Component = getDefaultComponent(type, libraries)!;
              const string = String(block.$heading[1]);
              return (
                <Component key={`${arrayIndex}-${childIndex}`}>
                  <ParseRichText>{string}</ParseRichText>
                </Component>
              );
            } else if ("$text" in block) {
              blockIndex++;
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
                          index={blockIndex}
                          ctx={ctx}
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
            } else {
              blockIndex++;
              return (
                <RenderElement
                  key={`${arrayIndex}-${childIndex}`}
                  id={block.id}
                  type={block.element}
                  record={record}
                  options={options}
                  index={blockIndex}
                  ctx={ctx}
                />
              );
            }
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
  index,
}: {
  id: NestedDocumentId;
  record: Record<string, ValueArray | ClientSyntaxTree>;
  type: string;
  options?: ConfigRecord;
  ctx: RSCContext;
  index: number;
}) => {
  let { config, component } = getConfigByType(type, {
    configs: ctx.configs,
    libraries: ctx.libraries,
    options,
  });

  if (!config || !component) return null;

  let symbol: symbol;
  if (!(config as any).symbol) {
    symbol = (config as any).symbol = Symbol();
  } else {
    symbol = (config as any).symbol;
  }

  let props = {
    props: config.props,
    component,
    record,
    id,
    type,
    createComponentContext: (regularProps: Record<string, any>) => {
      let context: Record<string, any>;
      if (typeof config?.context === "function") {
        context = config.context(regularProps);
      } else {
        context = config?.context ?? {};
      }
      return context;
    },
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
          const newCtx = {
            ...ctx,
            spread: true,
            loop: loopCtx,
          };
          return (
            <RenderElementWithProps
              // not really the accurate block index - this creates its own order
              index={newIndex}
              key={newIndex}
              ctx={newCtx}
              symbol={symbol}
              {...props}
            />
          );
        })}
      </>
    );
  }

  return (
    <RenderElementWithProps
      ctx={ctx}
      symbol={symbol}
      index={index}
      {...props}
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
  id,
  type,
  symbol,
  record,
  ctx,
  props,
  component: Component,
  createComponentContext,
  index,
}: {
  id: NestedDocumentId;
  type: string;
  symbol: symbol;
  record: Record<string, ValueArray | ClientSyntaxTree>;
  ctx: RSCContext;
  props: PropConfigRecord;
  component: Component<PropConfigRecord>;
  createComponentContext: (
    regularProps: Record<string, any>
  ) => Record<string, any>;
  index: number;
}) {
  const resolveProps = (props: PropConfigRecord, group?: string) => {
    const propEntries = Object.entries(props);
    const regularPropEntries = group
      ? propEntries
      : propEntries.filter(([, value]) => value.type !== "children");
    const regularProps = Object.fromEntries(
      regularPropEntries.map(([name, config]): [string, any] => {
        if (config.type === "group") {
          return [name, resolveProps(config.props, name)];
        }

        const key = extendPath(group ?? "", name, "#");

        const fieldId = `${id.slice(12, 24)}${getIdFromString(key)}`;

        const transforms = {
          file: fileTransform,
        };

        const value = resolveStatefulProp(record[fieldId] ?? [], ctx.loop);

        return [name, normalizeProp(config, value, transforms)];
      })
    );

    if (group) {
      return regularProps;
    }

    const contextsArray = [
      ...ctx.contexts,
      {
        element: symbol,
        index,
        context: createComponentContext(regularProps),
      },
    ];
    const contexts = Object.assign(contextsArray, {
      useContext(config: Config) {
        const symbol = (config as any).symbol;
        return (
          contextsArray.findLast((el) => el.element === symbol)?.context ?? {}
        );
      },
    });

    const childrenPropEntries = group
      ? []
      : propEntries.filter(([, value]) => value.type === "children");

    const childrenProps = Object.fromEntries(
      childrenPropEntries.map(([name, config]): [string, any] => {
        const fieldId = `${id.slice(12, 24)}${getIdFromString(name)}`;
        const value = resolveStatefulProp(record[fieldId] ?? [], ctx.loop);

        const children = (
          <RenderChildren
            value={Array.isArray(value[0]) ? value[0] : value}
            record={record}
            options={(config as PropConfig).options as ConfigRecord | undefined} // WE ARE USING PARENT OPTIONS ON PURPOSE!
            ctx={{
              ...ctx,
              contexts,
            }}
          />
        );

        return [name, children];
      })
    );

    return { ...regularProps, ...childrenProps, serverContext: contexts };
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
        spread: false,
        loop: {},
        children: undefined,
        configs,
        libraries,
        contexts: [],
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
        spread: false,
        loop: {},
        children,
        configs,
        libraries,
        contexts: [],
      }}
    />
  ) : (
    <>{children}</>
  );
};
