import { requestPaths } from "@storyflow/react/rsc";
import { options } from "./options";

export const staticParams = async (depth: number) => {
  const paths = (await requestPaths(options)).filter(
    (el) => el !== "" && el.split("/").length - 1 === depth
  );

  return paths.map((url) => {
    return Object.fromEntries(
      url
        .split("/")
        .slice(1)
        .map((el, index) => [`${index + 1}`, el])
    );
  });
};
