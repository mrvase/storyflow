import { calculateClient } from "@storyflow/client/calculate-client";
import {
  ClientSyntaxTree,
  Config,
  Context,
  FileToken,
  PropConfig,
  PropConfigRecord,
  PropGroup,
  ValueArray,
} from "@storyflow/shared/types";

export const splitProps = (props: PropConfigRecord) => {
  const entries = Object.entries(props);
  const regularProps: [
    string,
    (
      | PropConfig<
          "string" | "color" | "image" | "video" | "number" | "boolean" | "data"
        >
      | PropGroup
    )
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
  transforms: {
    file?: (value: FileToken | undefined) => any;
  }
) => {
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
  } else if (type === "color") {
    return String(value || "");
  }

  return value;
};

export const fileTransform = (value: FileToken | undefined) => {
  if (!value) {
    return {
      src: "",
      width: 0,
      height: 0,
    };
  }

  const url = process.env.IMAGE_URL ?? "";
  const src = `${url}/${value.src}`;

  const width = parseInt(value.src.split("-")[4] ?? "0", 16);
  const height = parseInt(value.src.split("-")[5] ?? "0", 16);

  return {
    src,
    width,
    height,
  };
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
