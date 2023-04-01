import { requestPaths } from "@storyflow/react/rsc";
import { options } from "./options";

export const staticParams = async (depth: number) => {
  const paths = (await requestPaths(options)).filter(
    (el) => el !== "" && el.split("/").length === depth
  );

  return paths.map((url) => {
    return Object.fromEntries(
      url.split("/").map((el, index) => [`${index + 1}`, el])
    );
  });
};
