import { PathSegment, PropConfig, ValueArray } from "@storyflow/frontend/types";
import React from "react";
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
import { getComponentByConfig } from "../config";

const calculateProp = (config: PropConfig, prop: any) => {
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

  const result = getComponentByConfig(type);

  if (!result) {
    return null;
  }

  const [Component, config] = result;

  const props = React.useMemo(
    () =>
      Object.fromEntries(
        config.props.map((config) => [
          config.name,
          calculateProp(config, uncomputedProps[config.name] ?? []),
        ])
      ),
    [uncomputedProps]
  );

  const [select] = useBuilderSelection();

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
      <Component {...props} />
    </AddPathSegment>
  );
}
