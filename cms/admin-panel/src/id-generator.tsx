import { unwrap } from "@storyflow/result";
import React from "react";
import { SWRClient, useClient } from "./client";
import { DocumentId } from "@storyflow/backend/types";
import { useUrlInfo } from "./users";

const IdContext = React.createContext<{
  getArticleId: () => Promise<DocumentId>;
  getFolderId: () => Promise<string>;
} | null>(null);

export function IdGenerator({ children }: { children: React.ReactNode }) {
  const { organization } = useUrlInfo();

  const { data: workspaceId } = SWRClient.ids.getWorkspaceId.useQuery();

  const getName = (name: string) => `${organization}:${name}`;

  const getValue = (name: string): string[] => {
    if (!workspaceId) {
      throw new Error("Tried to get value before initialization");
    }
    if (typeof window === "undefined") return [];
    const ls = localStorage.getItem(getName(name));
    if (!ls) return [];
    let value;
    try {
      value = JSON.parse(ls);
    } catch (err) {
      console.error(err);
      localStorage.removeItem(getName(name));
      return [];
    }
    if (
      typeof value !== "object" ||
      !("workspace" in value) ||
      !("ids" in value) ||
      !Array.isArray(value.ids) ||
      value.workspace !== workspaceId
    ) {
      localStorage.removeItem(getName(name));
      return [];
    }
    return value.ids;
  };

  const setValue = (name: string, ids: string[]) => {
    if (!workspaceId) return;
    localStorage.setItem(
      getName(name),
      JSON.stringify({
        workspace: workspaceId,
        ids,
      })
    );
  };

  const popValue = (name: string) => {
    const newValue = getValue(name);
    const [id] = newValue.splice(0, 1);
    setValue(name, newValue);
    return id;
  };

  const addValues = (name: string, values: string[]) => {
    const newValue = getValue(name);
    setValue(name, [...newValue, ...values]);
  };

  const promises = React.useRef({
    documents: null as (Promise<void> & { abort: () => void }) | null,
    folders: null as (Promise<void> & { abort: () => void }) | null,
  });

  const client = useClient();

  const fetchIds = async (to: "documents" | "folders") => {
    if (!promises.current[to]) {
      const promise = client.ids.getIds.query({ name: to, size: 10 });

      const promiseExtended = promise
        .then((result) => {
          if (promises.current[to]) {
            // don't do anything if component is unmounted.
            console.log("RESULT", unwrap(result));
            addValues(to, unwrap(result));
          }
        })
        .finally(() => {
          promises.current[to] = null;
        });

      const abortablePromise = Object.assign(promiseExtended, {
        abort() {
          promise.abort();
        },
      });

      promises.current[to] = abortablePromise;
    }
    return await promises.current[to];
  };

  const checkIds = async (from: "documents" | "folders") => {
    if (getValue(from).length < 5) {
      fetchIds(from);
    }
  };

  const getId = async (from: "documents" | "folders"): Promise<string> => {
    const id: string | undefined = popValue(from);
    if (id) {
      checkIds(from);
      return id;
    } else {
      await fetchIds(from);
      console.log("TRYING AGAIN");
      return await getId(from);
    }
  };

  React.useEffect(() => {
    if (!workspaceId) return;
    checkIds("documents");
    checkIds("folders");
    return () => {
      promises.current.documents?.abort();
      promises.current.documents = null;
      promises.current.folders?.abort();
      promises.current.folders = null;
    };
  }, [workspaceId]);

  const ctx = React.useMemo(
    () => ({
      getArticleId: () => getId("documents") as Promise<DocumentId>,
      getFolderId: () => getId("folders"),
    }),
    [workspaceId]
  );

  console.log("WORKSPACE ID", workspaceId);

  if (!workspaceId) {
    return null;
  }

  return <IdContext.Provider value={ctx}>{children}</IdContext.Provider>;
}

export const useArticleIdGenerator = () => {
  const ctx = React.useContext(IdContext);
  if (!ctx) throw Error("No IdContext.Provider");
  return ctx.getArticleId;
};

export const useFolderIdGenerator = () => {
  const ctx = React.useContext(IdContext);
  if (!ctx) throw Error("No IdContext.Provider");
  return ctx.getFolderId;
};
