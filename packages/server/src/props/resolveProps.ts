import { createRenderArray } from "./createRenderArray";
import { LibraryConfig, ValueArray } from "@storyflow/frontend/types";
import { Value } from "@storyflow/backend/types";
import { getConfigByType } from "./getConfigByType";

const BUCKET_NAME = "awss3stack-mybucket15d133bf-1wx5fzxzweii4";
const BUCKET_REGION = "eu-west-1";

const getImageObject = (name: string, slug: string) => {
  const src = `https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${slug}/${name}`;

  const width = name ? parseInt(name.split("-")[4] ?? "0", 10) : 0;
  const height = name ? parseInt(name.split("-")[5] ?? "0", 10) : 0;

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
                let array = recursive(el.props[name] as Value[], {
                  index: finalIndex,
                });
                let value: any = array[finalIndex % array.length];
                if (type === "children") {
                  value = {
                    $children: createRenderArray(
                      Array.isArray(value) ? value : array,
                      options.libraries
                    ),
                  };
                } else if (type === "image") {
                  if (
                    value !== null &&
                    typeof value === "object" &&
                    "src" in value
                  ) {
                    value = getImageObject(value.src, options.slug);
                  } else {
                    value = { url: "", width: 0, height: 0 };
                  }
                }
                return [name, value];
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