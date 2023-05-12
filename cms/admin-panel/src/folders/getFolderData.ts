import { DBFolder } from "@storyflow/cms/types";

type FolderType = "app" | "data";

export function getFolderData(folder: DBFolder) {
  const getType = (): FolderType => {
    if (Boolean(folder.spaces.find((el) => el.type === "pages"))) {
      return "app";
    } else {
      return "data";
    }
  };

  return {
    type: getType(),
  };
}
