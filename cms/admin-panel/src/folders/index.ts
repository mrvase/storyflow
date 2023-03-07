import { useFolders } from "../state/collab-folder";
import { useInitialFolders } from "./folders-context";

export const useTemplateFolder = () => {
  const ctx = useInitialFolders();
  return ctx.folders.find((el) => el.type === "templates")!;
};

export const useAppFolders = () => {
  const ctx = useFolders();
  return ctx.filter((el) => el.type === "app");
};
