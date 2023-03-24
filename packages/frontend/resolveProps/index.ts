import type {
  FetchPageResult,
  LibraryConfig,
  PropConfigArray,
  ValueArray,
} from "../types";
import { createRenderArray } from "../render";
import { getConfigByType } from "./getConfigByType";
// import { ComputationRecord, Value } from "@storyflow/backend/types";

type ComputationRecord = Record<string, ValueArray>;

/*
export const extendPath = (old: string, add: string, spacer: string = ".") => {
  return [old, add].filter(Boolean).join(spacer);
};

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

const createDisplayTypeGetter = (libraries: LibraryConfig[]) => {
  return (type: string) => Boolean(getConfigByType(type, libraries)?.inline);
};

const defaultLibrary: LibraryConfig = {
  name: "",
  label: "Default",
  components: {
    Outlet: {
      label: "Outlet",
      name: "Outlet",
      props: [],
    },
    Link: {
      label: "Link",
      name: "Link",
      props: [
        { name: "href", type: "string", label: "URL" },
        { name: "label", type: "string", label: "Label" },
      ],
      inline: true,
    },
  },
};

export const resolveFetchPageResult = (
  result: FetchPageResult,
  configs: LibraryConfig[]
) => {
  const options = {
    imageUrl: result.imageUrl,
    libraries: [defaultLibrary, ...configs],
  };

  return {
    ...result,
    page: result.page ? resolveProps(, options) : result.page,
    layout: result.layout
      ? resolveProps(result.layout, options)
      : result.layout,
  };
};

export const resolveProps = (
  docId: string,
  value: ValueArray,
  options: { imageUrl: string; libraries: LibraryConfig[] },
  ctx: { index: number } = { index: 0 }
) => {
  const createPropsFromConfig = (
    record: Record<string, ValueArray>,
    propConfigs: PropConfigArray,
    index: number,
    group?: string
  ) => {
    const keyId = 

    const hasKey = Boolean(propRecord.key?.length);

    return Object.fromEntries(
      propConfigs.map((propConfig) => {
        const { name, type } = propConfig;
        const finalIndex = hasKey ? index : ctx.index;
        const propKey = extendPath(group ?? "", name, "#");
        const propValue = propRecord[propKey];
        if (type === "children") {
          let propValueArray = propValue
            ? recursive(propValue as ValueArray, {
                index: finalIndex,
              }) ?? []
            : [];
          const value: any = propValueArray[finalIndex % propValueArray.length];
          const wrappedValue = {
            $children: createRenderArray(
              Array.isArray(value) ? value : propValueArray,
              createDisplayTypeGetter(options.libraries)
            ),
          };
          return [name, wrappedValue];
        } else {
          let value: any = propValue
            ? propValue[finalIndex % propValue.length]
            : undefined;

          if (
            propConfig.type !== "group" &&
            value !== null &&
            typeof value === "object" &&
            "name" in value
          ) {
            const option = Array.isArray(propConfig.options)
              ? propConfig.options.find(
                  (el): el is { value: any } | { name: any } =>
                    typeof el === "object" && el.name === value.name
                )
              : undefined;
            if (option && "value" in option) {
              value = option.value as any;
            }
          }
          if (
            propConfig.type !== "group" &&
            value !== null &&
            typeof value === "object" &&
            "color" in value
          ) {
            value = value.color;
          }
          if (["image", "video"].includes(type)) {
            if (value !== null && typeof value === "object" && "src" in value) {
              value = getImageObject(value.src, options.imageUrl);
            } else {
              value = { src: "", width: 0, height: 0 };
            }
          } else if (type === "boolean") {
            value = value === "false" ? false : Boolean(value);
          } else if (type === "number") {
            value = Number(value || 0);
          } else if (type === "string") {
            value = String(value || "");
          } else if (propConfig.type === "group") {
            value = createPropsFromConfig(
              propRecord,
              propConfig.props,
              index,
              propConfig.name
            );
          }
          return [name, value];
        }
      })
    );
  };

  const recursive = (value: ValueArray, ctx: { index: number }): ValueArray => {
    return value.reduce((acc: ValueArray, el) => {
      if (el !== null && typeof el === "object" && "type" in el) {
        const config = getConfigByType(el.type, options.libraries);
        if (!config) return acc;

        const length = el.props.key?.length || 1;

        Array.from({ length }, (_, index) => {
          acc.push({
            id: `${el.id}[${index}]`,
            type: config.name,
            props: createPropsFromConfig(el.props, config.props, index),
          });
        });

        return acc;
      } else if (typeof el !== "object") {
        acc.push(el);
      }
      return acc;
    }, []);
  };

  return createRenderArray(
    recursive(value, ctx),
    createDisplayTypeGetter(options.libraries)
  );
};
*/
