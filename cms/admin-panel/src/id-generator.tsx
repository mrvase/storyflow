import { unwrap } from "@storyflow/result";
import React from "react";
import { useClient } from "./client";
import { DocumentId } from "@storyflow/backend/types";

const IdContext = React.createContext<{
  getArticleId: () => Promise<DocumentId>;
  getFolderId: () => Promise<string>;
} | null>(null);

export function IdGenerator({ children }: { children: React.ReactNode }) {
  const getValue = (name: string): string[] => {
    if (typeof window === "undefined") return [];
    const ls = localStorage.getItem(name);
    if (!ls) return [];
    return JSON.parse(ls);
  };

  const popValue = (name: string) => {
    const newValue = getValue(name);
    const [id] = newValue.splice(0, 1);
    localStorage.setItem(name, JSON.stringify(newValue));
    return id;
  };

  const addValues = (name: string, values: string[]) => {
    const newValue = getValue(name);
    localStorage.setItem(name, JSON.stringify([...newValue, ...values]));
  };

  const promises = React.useRef({
    articles: null as (Promise<void> & { abort: () => void }) | null,
    folders: null as (Promise<void> & { abort: () => void }) | null,
  });

  const client = useClient();

  const fetchIds = async (to: "articles" | "folders") => {
    if (!promises.current[to]) {
      const promise = client.ids.getIds.query({ name: to, size: 10 });

      const promiseExtended = promise
        .then((result) => {
          if (promises.current[to]) {
            // don't do anything if component is unmounted.
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

  const checkIds = async (from: "articles" | "folders") => {
    if (getValue(from).length < 5) {
      fetchIds(from);
    }
  };

  const getId = async (from: "articles" | "folders"): Promise<string> => {
    const id: string | undefined = popValue(from);
    if (id) {
      checkIds(from);
      return id;
    } else {
      await fetchIds(from);
      return await getId(from);
    }
  };

  React.useEffect(() => {
    checkIds("articles");
    checkIds("folders");
    return () => {
      promises.current.articles?.abort();
      promises.current.articles = null;
      promises.current.folders?.abort();
      promises.current.folders = null;
    };
  }, []);

  const ctx = React.useMemo(
    () => ({
      getArticleId: () => getId("articles") as Promise<DocumentId>,
      getFolderId: () => getId("folders"),
    }),
    []
  );

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
