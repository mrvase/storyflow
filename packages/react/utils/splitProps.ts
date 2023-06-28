import { calculateClient } from "@storyflow/client/calculate-client";
import {
  ClientSyntaxTree,
  Config,
  Context,
  CustomTransforms,
  FileToken,
  PropConfig,
  PropConfigRecord,
  PropGroup,
  PropInput,
  PropTypeKey,
  Transforms,
  ValueArray,
} from "@storyflow/shared/types";

export const splitProps = (props: PropConfigRecord) => {
  const entries = Object.entries(props);
  const regularProps: [
    string,
    PropConfig<Exclude<PropTypeKey, "children">> | PropGroup | PropInput
  ][] = [];
  const childrenProps: [string, PropConfig<"children">][] = [];
  for (const [key, value] of entries) {
    if (value.type === "children") {
      childrenProps.push([key, value as PropConfig<"children">]);
    } else {
      regularProps.push([key, value as PropConfig<"string">]);
    }
  }
  return [regularProps, childrenProps] as [
    typeof regularProps,
    typeof childrenProps
  ];
};

export const resolveStatefulProp = (
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

export const normalizeProp = (
  config: PropConfig,
  prop: ValueArray,
  transforms_: CustomTransforms
) => {
  const transforms: Transforms = transforms_;

  const type = config.type;
  const value = prop[0];

  if (value !== null && typeof value === "object" && "name" in value) {
    const option = Array.isArray(config.options)
      ? config.options.find(
          (el): el is { alias: string; value: any } =>
            typeof el === "object" && el.alias === value.name
        )
      : undefined;
    if (option && "value" in option) return option.value;
  }

  if (value !== null && typeof value === "object" && "color" in value) {
    return value.color;
  }

  if (type === "image") {
    let str = typeof value === "object" && "src" in value ? value.src : "";
    return transforms.image ? transforms.image(str) : str;
  } else if (type === "video") {
    let str = typeof value === "object" && "src" in value ? value.src : "";
    return transforms.video ? transforms.video(str) : str;
  } else if (type === "file") {
    let str = typeof value === "object" && "src" in value ? value.src : "";
    return transforms.file ? transforms.file(str) : str;
  } else if (type === "boolean") {
    return value === "false" ? false : Boolean(value);
  } else if (type === "number") {
    return Number(value || 0);
  } else if (type === "string") {
    return String(value || "");
  } else if (type === "color") {
    return String(value || "");
  } else if (type === "date") {
    if (value !== null && typeof value === "object" && "date" in value) {
      try {
        const date = new Date(value.date);
        if (date.toString() !== "Invalid Date") {
          return date;
        }
      } catch (err) {}
    } else if (value instanceof Date) {
      return value;
    } else if (typeof value === "string" || typeof value === "number") {
      try {
        const date = new Date(value);
        if (date.toString() !== "Invalid Date") {
          return date;
        }
      } catch (err) {}
    }
    return new Date();
  }

  return value;
};

export const getComponentContextCreator = (
  provideContext?: Config["provideContext"]
) => {
  return (regularProps: Record<string, any>) => {
    let context: Context[] = [];
    if (typeof provideContext === "function") {
      const temp = provideContext(regularProps);
      context = Array.isArray(temp) ? temp : [temp];
    } else if (provideContext) {
      const temp = provideContext;
      context = Array.isArray(temp) ? temp : [temp];
    }
    return context;
  };
};
