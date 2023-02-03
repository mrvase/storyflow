import * as React from "react";
import {
  ComponentConfig,
  PathSegment,
  PropConfig,
  ValueArray,
} from "@storyflow/frontend/types";
import {
  AddPathSegment,
  ExtendPath,
  useBuilderSelection,
  usePath,
} from "./contexts";
import {
  focusCMSElement,
  getSiblings,
  isActiveEl,
  isActiveSibling,
} from "./focus";
import { useValue } from "../builder/RenderBuilder";
import RenderComponent from "./RenderComponent";
import { cms } from "../src/CMSElement";
import { getConfigByType } from "../config/getConfigByType";
import { getLibraries, getLibraryConfigs } from "../config";

const BUCKET_NAME = "awss3stack-mybucket15d133bf-1wx5fzxzweii4";
const BUCKET_REGION = "eu-west-1";

const getImageObject = (name: string, slug: string) => {
  const url = `https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${slug}/${name}`;

  const width = name ? parseInt(name.split("-")[1] ?? "0", 10) : 0;
  const height = name ? parseInt(name.split("-")[2] ?? "0", 10) : 0;

  return {
    url,
    width,
    height,
  };
};

const calculateProp = (config: PropConfig, prop: any) => {
  if (config.type === "image" && prop.length > 0) {
    const src = prop[0];
    if (!src.match(/\.(png|jpg|jpeg|gif)$/)) {
      return {
        url: "",
        width: 0,
        height: 0,
      };
    }
    return getImageObject(src, "kfs");
  }
  if (config.type === "children" && prop.length > 0) {
    return (
      <ExtendPath extend={config.name} spacer="/">
        <RenderComponent parentProp={config} />
      </ExtendPath>
    );
  } else {
    return prop[0];
  }
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

  const props = React.useMemo(
    () =>
      Object.fromEntries(
        config!.props.map((config) => [
          config.name,
          calculateProp(config, uncomputedProps?.[config.name] ?? []),
        ])
      ),
    [uncomputedProps]
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

  return (
    <AddPathSegment segment={segment}>
      <config.component {...props} />
    </AddPathSegment>
  );
}
