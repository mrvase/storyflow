import * as React from "react";
import {
  PropConfig,
  PropConfigArray,
  ValueArray,
} from "@storyflow/frontend/types";
import { ExtendPath, usePath } from "./contexts";
import {
  focusCMSElement,
  getSiblings,
  isActiveEl,
  isActiveSibling,
} from "./focus";
import { log, useValue } from "../builder/RenderBuilder";
import {
  ExtendedComponentConfig,
  getConfigByType,
} from "../config/getConfigByType";
import { getLibraries, getLibraryConfigs } from "../config";
import { extendPath } from "../utils/extendPath";
import RenderChildren from "./RenderChildren";
import { getIdFromString } from "../utils/getIdsFromString";
import { NoEditor } from "./editor";

export const IndexContext = React.createContext(0);
export const SpreadContext = React.createContext(false);

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
  prop: any,
  index: number
) => {
  const type = config.type;
  const value = prop[index % prop.length];
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
    const src = value?.src ?? "";
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
    return (
      <ExtendPath id={id}>
        <RenderChildren value={prop} />
      </ExtendPath>
    );
  }
  return prop[index % prop.length];
};

export default function RenderElement({
  type,
  props: propsFromProps,
}: {
  type: string;
  props?: Record<string, ValueArray>;
}) {
  const path = usePath();
  const elementId = path.slice(-1)[0];

  let config_ = getConfigByType(type, getLibraryConfigs(), getLibraries());

  if (!config_) {
    return null;
  }

  const config = config_;

  const uncomputedProps =
    propsFromProps ??
    Object.fromEntries(
      config.props.reduce((acc, cur) => {
        if (cur.type === "group") {
          cur.props.forEach((el) => {
            const id = `${elementId.slice(12, 24)}${getIdFromString(
              extendPath(cur.name, el.name, "#")
            )}`;
            acc.push([id, useValue(id) ?? []]);
          });
        } else {
          const id = `${elementId.slice(12, 24)}${getIdFromString(cur.name)}`;
          acc.push([id, useValue(id) ?? []]);
        }
        return acc;
      }, [] as [string, ValueArray][])
    );

  const keyId = `${elementId.slice(12, 24)}${getIdFromString("key")}`;
  const key = useValue(keyId) ?? [];

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

  if (key.length <= 1) {
    return (
      <RenderElementWithProps
        elementId={elementId}
        config={config}
        props={uncomputedProps}
      />
    );
  }

  return (
    <SpreadContext.Provider value={true}>
      {key.map((_, index) => (
        <IndexContext.Provider key={index} value={index}>
          <RenderElementWithProps
            elementId={elementId}
            config={config}
            props={uncomputedProps}
          />
        </IndexContext.Provider>
      ))}
    </SpreadContext.Provider>
  );
}

function RenderElementWithProps({
  elementId,
  props: uncomputedProps,
  config,
}: {
  elementId: string;
  props: any;
  config: ExtendedComponentConfig;
}) {
  const index = React.useContext(IndexContext);

  const calculatePropsFromConfig = (props: PropConfigArray, group?: string) => {
    return Object.fromEntries(
      props.map((config): [string, any] => {
        const key = extendPath(group ?? "", config.name, "#");
        const id = `${elementId.slice(12, 24)}${getIdFromString(key)}`;
        return [
          config.name,
          config.type === "group"
            ? calculatePropsFromConfig(config.props, config.name)
            : calculateProp(id, config, uncomputedProps?.[id] ?? [], index) ??
              [],
        ];
      })
    );
  };

  const props = React.useMemo(() => {
    const props = calculatePropsFromConfig(config.props);
    return props;
  }, [uncomputedProps, index]);

  log("PROPS PROPS", props);

  return (
    <NoEditor>
      <config.component {...props} />
    </NoEditor>
  );
}
