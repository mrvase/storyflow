import { getPaths } from "./localApi";

export const staticParams = async (depth: number) => {
  const paths = await getPaths(); // requestPaths(options)

  const filteredPaths = paths.filter(
    (el) => el !== "/" && el.split("/").length - 1 === depth
  );

  return filteredPaths.map((url) => {
    return Object.fromEntries(
      url
        .split("/")
        .slice(1)
        .map((el, index) => [`${index + 1}`, el])
    );
  });
};
