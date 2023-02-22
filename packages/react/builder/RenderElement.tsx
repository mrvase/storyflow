import * as React from "react";
import {
  PathSegment,
  PropConfig,
  PropConfigArray,
  ValueArray,
} from "@storyflow/frontend/types";
import { AddPathSegment, ExtendPath, usePath } from "./contexts";
import {
  focusCMSElement,
  getSiblings,
  isActiveEl,
  isActiveSibling,
} from "./focus";
import { useValue } from "../builder/RenderBuilder";
import RenderComponent from "./RenderComponent";
import { cms } from "../src/CMSElement";
import {
  ExtendedComponentConfig,
  getConfigByType,
} from "../config/getConfigByType";
import { getLibraries, getLibraryConfigs } from "../config";
import { extendPath } from "./extendPath";

export const IndexContext = React.createContext(0);

const BUCKET_NAME = "awss3stack-mybucket15d133bf-1wx5fzxzweii4";
const BUCKET_REGION = "eu-west-1";

const slug =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("slug")!
    : "";

const getImageObject = (name: string) => {
  const src = slug
    ? `https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${slug}/${name}`
    : "";

  const width = name ? parseInt(name.split("-")[4] ?? "0", 16) : 0;
  const height = name ? parseInt(name.split("-")[5] ?? "0", 16) : 0;

  return {
    src,
    width,
    height,
  };
};

const calculateProp = (config: PropConfig, prop: any, index: number) => {
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
  } else if (type === "children" && prop.length > 0) {
    return (
      <ExtendPath extend={config.name} spacer="/">
        <RenderComponent parentProp={config} />
      </ExtendPath>
    );
  }
  return prop[index % prop.length];
};

export default function RenderElement({
  type,
  parentProp,
  props: propsFromProps,
}: {
  type: string;
  parentProp: PropConfig | null;
  props?: Record<string, ValueArray>;
}) {
  const path = usePath();

  if (type === "Text") {
    // we want to select parent element;
    return <p>{propsFromProps!.text[0] as string}</p>;
  }

  const uncomputedProps =
    propsFromProps ?? (useValue(path) as Record<string, ValueArray>);

  let config_ = getConfigByType(type, getLibraryConfigs(), getLibraries());

  if (!config_) {
    return null;
  }

  const config = config_;

  const key = uncomputedProps?.key?.length ? uncomputedProps?.key : [""];

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

  const segment = React.useMemo(
    (): PathSegment => ({
      id: path.split(".").slice(-1)[0],
      label: config.label ?? type,
      parentProp: parentProp
        ? {
            label: parentProp.label,
            name: parentProp.name,
          }
        : null,
    }),
    [path, type]
  );

  if (key.length === 1) {
    return (
      <AddPathSegment segment={segment}>
        <RenderElementWithProps config={config} props={uncomputedProps} />
      </AddPathSegment>
    );
  }

  return (
    <AddPathSegment segment={segment}>
      {key.map((key, index) => (
        <IndexContext.Provider key={index} value={index}>
          <RenderElementWithProps config={config} props={uncomputedProps} />
        </IndexContext.Provider>
      ))}
    </AddPathSegment>
  );
}

function RenderElementWithProps({
  props: uncomputedProps,
  config,
}: {
  props: any;
  config: ExtendedComponentConfig;
}) {
  const index = React.useContext(IndexContext);

  const calculatePropsFromConfig = (props: PropConfigArray, group?: string) => {
    return Object.fromEntries(
      props.map((config): [string, any] => {
        const key = extendPath(group ?? "", config.name, "#");
        return [
          config.name,
          config.type === "group"
            ? calculatePropsFromConfig(config.props, config.name)
            : calculateProp(config, uncomputedProps?.[key] ?? [], index),
        ];
      })
    );
  };

  const props = React.useMemo(() => {
    const props = calculatePropsFromConfig(config.props);
    return props;
  }, [uncomputedProps, index]);

  return <config.component {...props} />;
}
