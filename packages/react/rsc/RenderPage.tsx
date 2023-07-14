import { createRenderArray } from "@storyflow/client/render";
import {
  ClientSyntaxTree,
  Component,
  Config,
  ConfigRecord,
  Context,
  ContextProvider,
  CustomTransforms,
  FileToken,
  Library,
  LibraryConfig,
  LibraryConfigRecord,
  LibraryRecord,
  NestedDocumentId,
  PropConfig,
  PropConfigRecord,
  ValueArray,
  context,
} from "@storyflow/shared/types";
import React from "react";
import { getConfigByType } from "../src/getConfigByType";
import { ParseRichText } from "../src/ParseRichText";
import { extendPath } from "../utils/extendPath";
import { getDefaultComponent } from "../src/getDefaultComponent";
import { getIdFromString } from "@storyflow/shared/getIdFromString";
import { defaultLibrary } from "../src/defaultLibrary";
import { defaultLibraryConfig } from "@storyflow/shared/defaultLibraryConfig";
import {
  getComponentContextCreator,
  normalizeProp,
  resolveStatefulProp,
  splitProps,
} from "../utils/splitProps";
import { IdContextProvider } from "../src/IdContext";

type ComponentContext = {
  element: symbol;
  index: number;
  serverContexts: Context[];
};

type RSCContext = {
  spread: boolean;
  loop: Record<string, number>;
  configs: Record<string, LibraryConfig>;
  libraries: Record<string, Library>;
  transforms: CustomTransforms;
  children?: React.ReactNode;
  contexts: ComponentContext[];
  isOpenGraph: boolean;
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
            } else if ("src" in block) {
              blockIndex++;
              const type = "Image";
              const Component = getDefaultComponent(type, libraries)!;
              const config =
                defaultLibraryConfig.configs.ImageConfig.props.image;
              return (
                <Component
                  key={`${arrayIndex}-${childIndex}`}
                  image={normalizeProp(config, [block], ctx.transforms)}
                />
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
    createComponentContext: getComponentContextCreator(config?.provideContext),
  };

  if (type === "Loop") {
    const rawDocumentId = id.slice(12, 24);
    const dataId = `${rawDocumentId}${getIdFromString("data")}`;

    return (
      <>
        {(record[dataId] as ValueArray).map((_, newIndex) => {
          const newCtx = {
            ...ctx,
            loop: {
              ...ctx.loop,
              [rawDocumentId]: newIndex,
            },
            spread: true,
          };
          return (
            <RenderElementWithProps
              // not really the accurate block index - this creates its own order
              index={newIndex}
              key={newIndex}
              ctx={newCtx}
              symbol={symbol}
              parentOptions={options}
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
  parentOptions,
}: {
  id: NestedDocumentId;
  type: string;
  symbol: symbol;
  record: Record<string, ValueArray | ClientSyntaxTree>;
  ctx: RSCContext;
  props: PropConfigRecord;
  component: Component<PropConfigRecord>;
  createComponentContext: (regularProps: Record<string, any>) => Context[];
  index: number;
  parentOptions?: ConfigRecord;
}) {
  const getFieldId = (key: string) =>
    `${id.slice(12, 24)}${getIdFromString(key)}`;

  const resolveProps = (props: PropConfigRecord, group: string = "") => {
    const [regularEntries, childrenEntries] = splitProps(props);
    const regularProps = Object.fromEntries(
      regularEntries.map(([name, config]): [string, any] => {
        if (config.type === "group") {
          return [name, resolveProps(config.props, name)];
        }

        if (config.type === "input") {
          const labelFieldId = getFieldId(extendPath(name, "label", "#"));
          const label = resolveStatefulProp(
            record[labelFieldId] ?? [],
            ctx.loop
          );

          return [
            name,
            {
              name,
              ...resolveProps(
                config.props ?? { label: { type: "string", label: "Label" } },
                name
              ),
            },
          ];
        }

        const fieldId = getFieldId(extendPath(group, name, "#"));

        if (config.type === "action") {
          return [name, fieldId];
        }

        const prop = resolveStatefulProp(record[fieldId] ?? [], ctx.loop);

        return [name, normalizeProp(config, prop, ctx.transforms)];
      })
    );

    if (group) {
      return regularProps;
    }

    const prevContexts = ctx.contexts;

    const contexts = [
      ...prevContexts,
      {
        element: symbol,
        index,
        serverContexts: createComponentContext(regularProps),
      },
    ];

    const childrenProps = Object.fromEntries(
      childrenEntries.map(([name, config]): [string, any] => {
        const fieldId = `${id.slice(12, 24)}${getIdFromString(name)}`;
        const value = resolveStatefulProp(record[fieldId] ?? [], ctx.loop);

        const children = (
          <RenderChildren
            value={Array.isArray(value[0]) ? value[0] : value}
            record={record}
            options={
              parentOptions ??
              ((config as PropConfig).options as ConfigRecord | undefined)
            } // WE ARE USING PARENT OPTIONS ON PURPOSE!
            ctx={{
              ...ctx,
              contexts,
            }}
          />
        );

        return [name, children];
      })
    );

    const useServerContext = (provider: ContextProvider) => {
      for (let i = prevContexts.length - 1; i >= 0; i--) {
        const result = prevContexts[i].serverContexts.findLast(
          (c) => c[context] === provider[context]
        );
        if (result) {
          return result.value;
        }
      }
    };

    const isServerComponent = typeof (Component as any).$$typeof !== "symbol";

    return {
      ...regularProps,
      ...childrenProps,
      ...(isServerComponent ? { useServerContext } : {}),
    };
  };

  const resolvedProps = resolveProps(props);

  const IdContextProvider_ = !ctx.isOpenGraph
    ? IdContextProvider
    : React.Fragment;

  return (
    <IdContextProvider_ id={id}>
      <Component {...resolvedProps} />
    </IdContextProvider_>
  );
}

export const RenderPage = <T extends LibraryConfigRecord>({
  data,
  configs: configsFromProps,
  libraries: librariesFromProps,
  transforms = {} as any,
  isOpenGraph,
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
  isOpenGraph?: boolean;
} & ({} extends CustomTransforms
  ? { transforms?: CustomTransforms }
  : { transforms: CustomTransforms })) => {
  const libraries = { ...librariesFromProps, "": defaultLibrary };

  const configs = {
    ...configsFromProps,
    "": defaultLibraryConfig,
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
        transforms,
        contexts: [],
        isOpenGraph: Boolean(isOpenGraph),
      }}
    />
  ) : null;
};
export const RenderLayout = <T extends LibraryConfigRecord>({
  data,
  children,
  configs: configsFromProps,
  libraries: librariesFromProps,
  transforms = {} as any,
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
} & ({} extends CustomTransforms
  ? { transforms?: CustomTransforms }
  : { transforms: CustomTransforms })) => {
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
        transforms,
        contexts: [],
        isOpenGraph: false,
      }}
    />
  ) : (
    <>{children}</>
  );
};
