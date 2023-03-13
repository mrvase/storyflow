import { unwrap } from "@storyflow/result";
import { createQueue } from "@storyflow/state";
import React from "react";
import { Client, SWRClient, useCache } from "../client";
import {
  ComputationBlock,
  DBDocument,
  DocumentId,
  TemplateDocument,
  FlatComputation,
  ValueRecord,
} from "@storyflow/backend/types";
import { pushAndRetry } from "../utils/retryOnError";
import { TEMPLATES } from "@storyflow/backend/templates";

type ArticleListMutation =
  | {
      type: "insert";
      id: string;
      label?: string;
      values: ValueRecord;
      compute: { id: string; value: FlatComputation }[];
    }
  | {
      type: "remove";
      id: string;
    };

type ArticleListOperation = {
  folder: string;
  actions: ArticleListMutation[];
};

const queue = createQueue<ArticleListOperation>("documents", {
  clientId: null,
}).initialize(0, []);

const getArticleFromInsert = (
  folder: string,
  action: ArticleListMutation
): DBDocument | undefined => {
  if (action.type !== "insert") return;
  return {
    id: action.id as DocumentId,
    folder,
    versions: {},
    values: action.values,
    compute: action.compute as ComputationBlock[],
    config: [],
    ...(action.label && { label: action.label }),
  };
};

const optimisticUpdate = (
  articles: DBDocument[],
  folder: string,
  actions: ArticleListMutation[]
): DBDocument[] => {
  let inserts: DBDocument[] = [];
  let removes: string[] = [];

  actions.forEach((action) => {
    if (action.type === "insert") {
      inserts.push(getArticleFromInsert(folder, action)!);
    } else {
      removes.push(action.id);
    }
  });

  return [...articles, ...inserts].filter((el) => !removes.includes(el.id));
};

export function useArticleList(folderId: string | undefined) {
  const { data, error } = SWRClient.articles.getList.useQuery(
    folderId as string,
    {
      inactive: !folderId,
    }
  );

  const [operations, setOperations] = React.useState<ArticleListOperation[]>(
    []
  );

  React.useEffect(() => {
    return queue.register(({ forEach }) => {
      const newOps: ArticleListOperation[] = [];
      forEach(({ operation }) => {
        newOps.push(operation);
      });
      setOperations(newOps);
    });
  }, []);

  const articles = React.useMemo(() => {
    if (!data || !folderId) return undefined;
    const actions = operations
      .filter(({ folder }) => folder === folderId)
      .reduce(
        (acc, { actions }) => [...acc, ...actions],
        [] as ArticleListMutation[]
      );
    return optimisticUpdate(data.articles, folderId, actions);
  }, [folderId, data, operations]);

  return { articles, error };
}

const getArticleFromOperations = (
  articleId: string | undefined,
  operations: ArticleListOperation[]
) => {
  if (!articleId) return;
  let article: DBDocument | undefined;
  operations.forEach(({ actions, folder }) => {
    actions.forEach((action) => {
      if (action.type === "insert" && action.id === articleId) {
        article = getArticleFromInsert(folder, action)!;
      }
    });
  });
  return article;
};

export async function fetchArticle(
  id: string,
  client: Client
): Promise<DBDocument | undefined> {
  const result = await client.articles.get.query(id, {
    useCache,
  });
  return unwrap(result)?.article;
  /*
  const key = SWRKey(`http://localhost:3001/api/articles/get`, id);
  let exists = SWRCache.get(key);
  if (!exists || exists.isLoading === true) {
    const result = await client.articles.get.query(id);
    if (isError(result)) {
      return;
    }
    const data = unwrap(result);
    exists = SWRCache.get(key);
    if (!exists) {
      SWRCache.set(key, {
        data,
        isValidating: false,
        isLoading: false,
        error: undefined,
      });
    } else {
      // cache might not be set yet, if swr has set isLoading = true
      return data.article;
    }
  }
  return SWRCache.get(key).data.article as Article;
  */
}

export function useArticle(
  articleId: string | undefined,
  options: { inactive?: boolean } = {}
) {
  const [initialArticle, setInitialArticle] = React.useState(() => {
    const operations: ArticleListOperation[] = [];
    queue.forEach(({ operation }) => {
      operations.push(operation);
    });
    return getArticleFromOperations(articleId, operations);
  });

  const { data, error, mutate } = SWRClient.articles.get.useQuery(
    articleId as string,
    {
      inactive: options.inactive || !articleId,
    }
  );

  React.useEffect(() => {
    if (initialArticle !== undefined && data !== undefined) {
      setInitialArticle(undefined);
    }
  }, [initialArticle, data]);

  const article = React.useMemo(() => {
    if (!articleId) return undefined;
    if (data?.article) {
      return data.article;
    }
    return initialArticle;
  }, [articleId, data, initialArticle]);

  return {
    article,
    histories: data?.histories ?? {},
    mutate,
    error: initialArticle ? undefined : error,
  };
}

export function useArticleTemplate(
  id: string | undefined,
  options: { inactive?: boolean } = {}
): TemplateDocument | undefined {
  const defaultTemplate = TEMPLATES.find((el) => el.id === id);
  if (defaultTemplate) {
    return defaultTemplate;
  }
  const { article } = useArticle(id, options);

  return article;
}

export const useArticleListMutation = () => {
  const mutate = SWRClient.articles.listOperation.useMutation({
    cacheUpdate: (input, mutate) => {
      const groups = input.reduce(
        (acc: Record<string, ArticleListMutation[]>, cur) => {
          return {
            [cur.folder]: [...(acc[cur.folder] ?? []), ...cur.actions],
          };
        },
        {}
      );

      Object.entries(groups).map(([folder, actions]) => {
        mutate(["getList", folder], (ps, result) => {
          if (result === undefined) {
            // we handle optimistic updates separately
            // so that we do not update the cache
            // on error
            return ps;
          }

          const articles = optimisticUpdate(ps.articles, folder, actions);

          return {
            articles,
          };
        });
      });
    },
  });

  return (operation: ArticleListOperation) => {
    pushAndRetry("documents", operation, mutate, queue);
  };
};

export const useSaveArticle = (folder: string) => {
  return SWRClient.articles.save.useMutation({
    cacheUpdate: ({ id }, mutate) => {
      mutate(["getList", folder], (ps, result) => {
        if (!result) {
          return ps;
        }
        const index = ps.articles.findIndex((el) => el.id === id);
        const newArticles = [...ps.articles];
        newArticles[index] = { ...newArticles[index], ...result };
        return {
          articles: newArticles,
        };
      });
      mutate(["get", id], (ps, result) => {
        if (!result) {
          return ps;
        }
        return {
          ...ps,
          article: result,
          histories: {},
        };
      });
    },
  });
};
