// import { createRenderArray } from "./createRenderArray";
import type {
  LibraryConfig,
  PropConfigArray,
  ValueArray,
} from "@storyflow/frontend/types";
import { createRenderArray } from "@storyflow/frontend/render";
import { getConfigByType } from "./getConfigByType";
import { Value } from "@storyflow/backend/types";
import { extendPath } from "@storyflow/backend/extendPath";

const BUCKET_NAME = "awss3stack-mybucket15d133bf-1wx5fzxzweii4";
const BUCKET_REGION = "eu-west-1";

const getImageObject = (name: string, slug: string) => {
  const src = `https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${slug}/${name}`;

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

export const resolveProps = (
  value: Value[],
  options: { slug: string; libraries: LibraryConfig[] },
  ctx: { index: number }
) => {
  const recursive = (value: Value[], ctx: { index: number }): ValueArray => {
    return value.reduce((acc: ValueArray, el) => {
      if (el !== null && typeof el === "object" && "type" in el) {
        const config = getConfigByType(el.type, options.libraries);
        if (!config) return acc;

        const hasKey = Boolean(el.props.key?.length);
        const length = el.props.key?.length || 1;

        Array.from({ length }, (_, index) => {
          const createPropsFromConfig = (
            props: PropConfigArray,
            group?: string
          ) => {
            return Object.fromEntries(
              props.map((propConfig) => {
                const { name, type } = propConfig;
                const finalIndex = hasKey ? index : ctx.index;
                const key = extendPath(group ?? "", name, "#");
                let prop = el.props[key];
                if (type === "children") {
                  let array = prop
                    ? recursive(prop as Value[], {
                        index: finalIndex,
                      }) ?? []
                    : [];
                  let value: any = array[finalIndex % array.length];
                  value = {
                    $children: createRenderArray(
                      Array.isArray(value) ? value : array,
                      createDisplayTypeGetter(options.libraries)
                    ),
                  };
                  return [name, value];
                } else {
                  const array = prop ?? [];
                  let value: any = array[finalIndex % array.length];
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
                    if (
                      value !== null &&
                      typeof value === "object" &&
                      "src" in value
                    ) {
                      value = getImageObject(value.src, options.slug);
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
                      propConfig.props,
                      propConfig.name
                    );
                  }
                  return [name, value];
                }
              })
            );
          };
          acc.push({
            id: `${el.id}[${index}]`,
            type: config.name,
            props: createPropsFromConfig(config.props),
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
