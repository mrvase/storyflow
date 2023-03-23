import { createRenderArray } from "@storyflow/frontend/render";
import { extendPath } from "@storyflow/frontend/resolveProps";
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
import { getDefaultComponent } from "../utils/getDefaultComponent";
import { getIdFromString } from "../utils/getIdsFromString";

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
  index: number,
  transforms: {
    children: (value: ValueArray | undefined) => React.ReactElement;
    file?: (value: FileToken | undefined) => any;
  }
) => {
  const type = config.type;
  const value = prop[index % prop.length] as ValueArray[number] | undefined;

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
    return transforms.children(prop);
  }

  return value;
};

const RenderChildren = ({
  value,
  record,
  index,
  children,
}: {
  value: ValueArray;
  record: Record<string, ValueArray>;
  index: number;
  children: React.ReactNode;
}) => {
  const libraries = getLibraries();
  const configs = getLibraryConfigs();

  const renderArray = (() => {
    const valueAtIndex = value[index];
    const value_ =
      Array.isArray(valueAtIndex) && valueAtIndex.length === 1
        ? valueAtIndex
        : value;
    if (!value) return [];
    return createRenderArray(value_, (type: string) =>
      Boolean(getConfigByType(type, configs)?.inline)
    );
  })();

  return (
    <>
      {renderArray.reduce((acc, block, index) => {
        const renderChildren = "$children" in block ? block.$children : [block];

        acc.push(
          ...renderChildren.map((block, childIndex) => {
            if ("element" in block && block.element === "Outlet") {
              return <React.Fragment key="Outlet">{children}</React.Fragment>;
            }
            if ("$heading" in block) {
              const type = `H${block.$heading[0]}`;
              const Component = getDefaultComponent(type, libraries)!;
              const string = String(block.$heading[1]);
              return (
                <Component key={`${index}-${childIndex}`}>
                  <ParseRichText>{string}</ParseRichText>
                </Component>
              );
            }
            if ("$text" in block) {
              const type = "Text";
              const Component = getDefaultComponent(type, libraries)!;
              return (
                <Component key={`${index}-${childIndex}`}>
                  {block.$text.map((el, textElementIndex) => {
                    if (typeof el === "object") {
                      return (
                        <RenderElement
                          id={el.id}
                          type={el.element}
                          record={record}
                          index={0}
                          children={children}
                        />
                      );
                    }
                    return (
                      <ParseRichText
                        key={`${index}-${childIndex}-${textElementIndex}`}
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
                index={0}
                children={children}
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
  index,
  children,
}: {
  id: string;
  record: Record<string, ValueArray>;
  type: string;
  index: number;
  children: React.ReactNode;
}) => {
  let config_ = getConfigByType(type, getLibraryConfigs(), getLibraries());

  if (!config_) {
    return null;
  }

  const config = config_;

  const keyId = `${id.slice(12, 24)}${getIdFromString("key")}`;

  const key = record?.[keyId]?.length ? record?.[keyId] : [""];

  const renderChildren = (value: ValueArray | undefined) => {
    return (
      <RenderChildren
        value={value ?? []}
        record={record}
        index={index}
        children={children}
      />
    );
  };

  if (key.length === 1) {
    return (
      <RenderElementWithProps
        elementId={id}
        config={config}
        record={record}
        index={index}
        renderChildren={renderChildren}
      />
    );
  }

  return (
    <>
      {key.map((_, newIndex) => (
        <RenderElementWithProps
          key={index}
          elementId={id}
          config={config}
          record={record}
          index={newIndex}
          renderChildren={renderChildren}
        />
      ))}
    </>
  );
};

function RenderElementWithProps({
  elementId,
  record,
  index,
  config,
  renderChildren,
}: {
  elementId: string;
  record: Record<string, ValueArray>;
  index: number;
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

        return [
          config.name,
          normalizeProp(config, record[id] ?? [], index, {
            children: renderChildren,
            file: (value) => {
              if (!value)
                return {
                  src: "",
                  width: 0,
                  height: 0,
                };
              return getImageObject(value.src, process.env.IMAGE_URL ?? "");
            },
          }) ?? [],
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
      index={0}
      children={<></>}
    />
  ) : (
    <>{(() => console.error("No data"))()}</>
  );

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
      index={0}
      children={children}
    />
  ) : (
    <>{children}</>
  );
};
