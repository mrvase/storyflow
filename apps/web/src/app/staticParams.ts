import { requestPaths } from "./request";

export const staticParams = async (depth: number) => {
  const paths = (await requestPaths()).filter(
    (el) => el !== "" && el.split("/").length === depth
  );
  return paths.map((url) => {
    return Object.fromEntries(
      url.split("/").map((el, index) => [`${index + 1}`, el])
    );
  });
};

/*
export const staticParams = async (array: string[]) => {
  return array.map((url) => {
    return Object.fromEntries(
      url.split("/").map((el, index) => [`${index + 1}`, el])
    );
  });
};
*/
