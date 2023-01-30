import { SWRClient } from "../client";
import {
  FolderMutation,
  pushFolderAndRetry,
  useFolders,
} from "./folders-context";

export { useFolders } from "./folders-context";

export const useFolder = (folderId?: string) => {
  const ctx = useFolders();
  return ctx.folders?.find((el) =>
    folderId ? el.id === folderId : el.type === "root"
  );
};

export const useTemplateFolder = () => {
  const ctx = useFolders();
  return ctx.folders?.find((el) => el.type === "templates");
};

export const useAppFolders = () => {
  const ctx = useFolders();
  return ctx.folders?.filter((el) => el.type === "app");
};

export const useFolderMutation = (id: string) => {
  const mutate = SWRClient.folders.update.useMutation({
    cacheUpdate(input, update) {
      update(["get", undefined], (ps, result) => {
        if (result === undefined) {
          // do optimistic update
          return ps;
          /*
          const active = input.actions[input.actions.length - 1];
          return optimisticUpdate(ps, {
            id: input.id,
            actions: [active],
          });
          */
        }
        const newList = [...ps];
        result.forEach((folder) => {
          const index = ps.findIndex((el) => el.id === folder.id);
          if (index < 0) {
            newList.push(folder);
          } else {
            newList[index] = folder;
          }
        });
        return newList;
      });
    },
    options: {
      rollbackOnError: false,
    },
  });

  return (input: FolderMutation) => {
    pushFolderAndRetry(
      "folders",
      {
        id,
        actions: [input],
      },
      mutate
    );
  };
};
