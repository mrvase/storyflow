import { createRenderArray } from "./createRenderArray";
import { LibraryConfig, ValueArray } from "@storyflow/frontend/types";
import { Value } from "@storyflow/backend/types";
import { getConfigByType } from "./getConfigByType";

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
          acc.push({
            id: `${el.id}[${index}]`,
            type: config.name,
            props: Object.fromEntries(
              config.props.map(({ name, type }) => {
                const finalIndex = hasKey ? index : ctx.index;
                const prop = el.props[name];
                if (type === "children") {
                  let array = prop
                    ? recursive(el.props[name] as Value[], {
                        index: finalIndex,
                      })
                    : [];
                  let value: any = array[finalIndex % array.length];
                  value = {
                    $children: createRenderArray(
                      Array.isArray(value) ? value : array,
                      options.libraries
                    ),
                  };
                  return [name, value];
                } else {
                  let value: any =
                    el.props[name][finalIndex % el.props[name].length];
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
                  }
                  return [name, value];
                }
              })
            ),
          });
        });

        return acc;
      } else if (typeof el !== "object") {
        acc.push(el);
      }
      return acc;
    }, []);
  };
  return createRenderArray(recursive(value, ctx), options.libraries);
};
