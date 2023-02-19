import { DBFolder, DocumentId, FolderChild } from "@storyflow/backend/types";
import { createQueue } from "@storyflow/state";
import React from "react";
import { SWRClient } from "../client";
import { pushAndRetry } from "../utils/retryOnError";

export type FolderMutation =
  | {
      type: "reorder";
      children: FolderChild[];
      insert?:
        | {
            id: string;
            label: string;
            type: "data";
          }
        | {
            id: string;
            label: string;
            type: "app";
            frontId: DocumentId;
          };
    }
  | { name: "label"; value: string }
  | { name: "domains"; value: string[] }
  | { name: "template"; value: string };

export type FolderOperation = {
  id: string;
  actions: FolderMutation[];
};

const queue = createQueue<FolderOperation>("folders", {
  clientId: null,
}).initialize(0, []);

const FoldersContext = React.createContext<{
  folders: DBFolder[] | undefined;
  error: { message: string; error?: any } | undefined;
} | null>(null);

export const useFolders = () => {
  const ctx = React.useContext(FoldersContext);
  if (!ctx) throw new Error("Found no FoldersProvider");
  return ctx;
};

const optimisticUpdate = (ps: DBFolder[], input: FolderOperation[]) => {
  const updates = new Map<
    string,
    { id: string; label?: string; template?: string; children?: FolderChild[] }
  >();
  const inserts = new Map<string, DBFolder>();

  const setProp = (key: string, name: string, value: any) => {
    const insert = inserts.get(key);
    if (insert) {
      inserts.set(key, { ...insert, [name]: value });
      return;
    }
    const update = updates.get(key);
    if (update) {
      updates.set(key, { ...update, [name]: value });
    } else {
      updates.set(key, { id: key, [name]: value });
    }
  };

  const setChildren = (key: string, children: FolderChild[]) => {
    const insert = inserts.get(key);
    if (insert) {
      inserts.set(key, {
        ...insert,
        children: [...insert.children, ...children],
      });
      return;
    }
    const update = updates.get(key);
    if (update) {
      updates.set(key, {
        ...update,
        children: [...(update.children ?? []), ...children],
      });
    } else {
      updates.set(key, { id: key, children });
    }
  };

  input.forEach((operation) => {
    operation.actions.map((action) => {
      if ("name" in action) {
        setProp(operation.id, action.name, action.value);
      } else if (action.type === "reorder") {
        setChildren(operation.id, action.children);
        if (action.insert) {
          inserts.set(operation.id, {
            ...action.insert,
            children: [],
          });
        }
      }
    });
  });

  const newList = [...ps, ...Array.from(inserts.values())];

  Array.from(updates.values(), ({ id, label, template, children }) => {
    const index = newList.findIndex((el) => el.id === id)!;
    newList[index] = { ...newList[index] };

    if (label !== undefined) {
      newList[index].label = label;
    }
    if (template !== undefined) {
      newList[index].template = template as DocumentId;
    }
    if (children !== undefined) {
      newList[index].children = [...newList[index].children, ...children];
    }
  });

  return newList;
};

export const FoldersProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { data, error } = SWRClient.folders.get.useQuery(undefined, {
    // refreshInterval: 10000,
  });

  const [operations, setOperations] = React.useState<FolderOperation[]>([]);

  React.useEffect(() => {
    return queue.register(({ forEach }) => {
      const newOps: FolderOperation[] = [];
      forEach(({ operation }) => {
        newOps.push(operation);
      });
      setOperations(newOps);
    });
  }, []);

  const folders = React.useMemo(() => {
    if (!data) return undefined;
    // TODO: Queue changes setOperation a little bit after
    // new data is returned. So there is a point at which
    // new operations are added twice.
    return optimisticUpdate(data, operations);
  }, [data, operations]);

  const ctx = React.useMemo(() => {
    return {
      folders,
      error,
    };
  }, [folders, error]);

  return (
    <FoldersContext.Provider value={ctx}>{children}</FoldersContext.Provider>
  );
};

export const pushFolderAndRetry = (
  id: string,
  operation: FolderOperation,
  mutate: any
) => pushAndRetry(id, operation, mutate, queue);
