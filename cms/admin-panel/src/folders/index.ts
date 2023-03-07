import { useInitialFolders } from "./folders-context";

export const useTemplateFolder = () => {
  const ctx = useInitialFolders();
  return ctx.folders.find((el) => el.type === "templates");
};

export const useAppFolders = () => {
  const ctx = useInitialFolders();
  return ctx.folders?.filter((el) => el.type === "app");
};
