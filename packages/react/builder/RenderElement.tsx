import * as React from "react";
import {
  ClientSyntaxTree,
  Component,
  Config,
  ConfigRecord,
  Library,
  LibraryConfig,
  PropConfig,
  PropConfigRecord,
  ValueArray,
} from "@storyflow/shared/types";
import { ExtendPath, useConfig, usePath } from "./contexts";
import {
  focusCMSElement,
  getSiblings,
  isActiveEl,
  isActiveSibling,
} from "./focus";
import { log, useValue } from "../builder/RenderBuilder";
import { getConfigByType } from "../src/getConfigByType";
import { extendPath } from "../utils/extendPath";
import RenderChildren from "./RenderChildren";
import { getIdFromString } from "@storyflow/shared/getIdFromString";
import { NoEditor } from "./editor";
import { calculateClient } from "@storyflow/client/calculate-client";

type LoopIndexRecord = Record<string, number>;

export const LoopContext = React.createContext<LoopIndexRecord>({});
export const IndexContext = React.createContext(0);
export const SpreadContext = React.createContext(false);

const initialLoop = {};

function LoopProvider({
  id,
  index,
  children,
}: {
  id: string;
  index: number;
  children: React.ReactNode;
}) {
  const current = React.useContext(LoopContext) ?? initialLoop;

  return (
    <LoopContext.Provider
      value={React.useMemo(() => ({ ...current, [id]: index }), [current])}
    >
      {children}
    </LoopContext.Provider>
  );
}

const slug =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("slug")!
    : "";

const getImageObject = (name: string) => {
  const src = slug ? `https://cdn.storyflow.dk/${slug}/${name}` : "";

  const width = name ? parseInt(name.split("-")[4] ?? "0", 16) : 0;
  const height = name ? parseInt(name.split("-")[5] ?? "0", 16) : 0;

  return {
    src,
    width,
    height,
  };
};

const calculateProp = (
  id: string,
  config: PropConfig,
  prop: ValueArray | ClientSyntaxTree,
  loopCtx: LoopIndexRecord,
  parentOptions?: ConfigRecord
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
    const src =
      typeof value === "object" ? (value as { src: string })?.src ?? "" : "";
    if (
      !src.match(/\.(png|jpg|jpeg|gif)$/) &&
      !src.match(/\.(mp4|mov|wmv|avi)$/)
    ) {
      return {
        src: "",
        width: 0,
        height: 0,
      };
    }
    return getImageObject(src);
  } else if (type === "boolean") {
    return value === "false" ? false : Boolean(value);
  } else if (type === "number") {
    return Number(value || 0);
  } else if (type === "string") {
    return String(value || "");
  } else if (type === "children") {
    const children = Array.isArray(value) ? value : array;
    return (
      <ExtendPath id={id}>
        <RenderChildren
          value={children}
          options={parentOptions ?? (config.options as ConfigRecord)}
        />
      </ExtendPath>
    );
  }
  return value;
};

export default function RenderElement({
  type,
  options,
}: {
  type: string;
  options?: ConfigRecord;
}) {
  const { configs, libraries } = useConfig();

  const path = usePath();
  const elementId = path.slice(-1)[0];

  let { config, component } = getConfigByType(type, {
    configs,
    libraries,
    options,
  });

  if (!config || !component) {
    return null;
  }

  const uncomputedProps = Object.fromEntries(
    Object.entries(config.props).reduce((acc, [name, cur]) => {
      if (cur.type === "group") {
        const groupName = name;
        Object.entries(cur.props).forEach(([name, el]) => {
          const id = `${elementId.slice(12, 24)}${getIdFromString(
            extendPath(groupName, name, "#")
          )}`;
          acc.push([id, useValue(id) ?? []]);
        });
      } else {
        const id = `${elementId.slice(12, 24)}${getIdFromString(name)}`;
        acc.push([id, useValue(id) ?? []]);
      }
      return acc;
    }, [] as [string, ValueArray | ClientSyntaxTree][])
  );

  React.useEffect(() => {
    const activeEl = document.activeElement as HTMLElement;
    if (isActiveSibling(activeEl, path)) {
      focusCMSElement(path);
    }
  }, []);

  let prevType = React.useRef(type);

  React.useEffect(() => {
    if (type !== prevType.current) {
      focusCMSElement(path);
    }
    return () => {
      prevType.current = type;
    };
  }, [type]);

  React.useLayoutEffect(() => {
    return () => {
      // onDestroy
      const activeEl = document.activeElement as HTMLElement;
      if (isActiveEl(activeEl, path)) {
        const siblings = getSiblings(activeEl);
        const index = siblings.findIndex((el) => el === activeEl);
        if (index < siblings.length - 1) {
          requestAnimationFrame(() => siblings[index + 1].focus());
        } else if (siblings.length > 1) {
          requestAnimationFrame(() => siblings[siblings.length - 2].focus());
        }
      }
    };
  }, []);

  if (type === "Loop") {
    const rawDocumentId = elementId.slice(12, 24);
    const dataId = `${rawDocumentId}${getIdFromString("data")}`;
    return (
      <SpreadContext.Provider value={true}>
        {(uncomputedProps[dataId] as ValueArray).map((_, index) => {
          return (
            <LoopProvider key={index} id={rawDocumentId} index={index}>
              <RenderElementWithProps
                elementId={elementId}
                props={config!.props}
                component={component!}
                values={uncomputedProps}
                parentOptions={options}
              />
            </LoopProvider>
          );
        })}
      </SpreadContext.Provider>
    );
  }

  return (
    <RenderElementWithProps
      elementId={elementId}
      component={component}
      props={config.props}
      values={uncomputedProps}
    />
  );
}

function RenderElementWithProps({
  elementId,
  values,
  props,
  component: Component,
  parentOptions,
}: {
  elementId: string;
  values: Record<string, ValueArray | ClientSyntaxTree>;
  props: Config["props"];
  component: Component<PropConfigRecord>;
  parentOptions?: ConfigRecord;
}) {
  const loopCtx = React.useContext(LoopContext);
  // const index = React.useContext(IndexContext);

  const calculatePropsFromConfig = (
    props: PropConfigRecord,
    group?: string
  ) => {
    return Object.fromEntries(
      Object.entries(props).map(([name, config]): [string, any] => {
        const key = extendPath(group ?? "", name, "#");
        const id = `${elementId.slice(12, 24)}${getIdFromString(key)}`;
        return [
          name,
          config.type === "group"
            ? calculatePropsFromConfig(config.props, name)
            : calculateProp(
                id,
                config,
                values?.[id] ?? [],
                loopCtx,
                parentOptions
              ) ?? [],
        ];
      })
    );
  };

  const resolvedProps = React.useMemo(() => {
    return calculatePropsFromConfig(props);
  }, [values, props, loopCtx, parentOptions]);

  log("PROPS PROPS", resolvedProps);

  return (
    <NoEditor>
      <Component {...resolvedProps} />
    </NoEditor>
  );
}
