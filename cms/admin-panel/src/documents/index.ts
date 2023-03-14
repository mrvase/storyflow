import { unwrap } from "@storyflow/result";
import { createQueue } from "@storyflow/state";
import React from "react";
import { Client, SWRClient, useCache } from "../client";
import {
  ComputationRecord,
  DBDocument,
  DocumentId,
  FolderId,
  TemplateDocument,
} from "@storyflow/backend/types";
import { pushAndRetry } from "../utils/retryOnError";
import { FIELDS } from "@storyflow/backend/fields";
import { TEMPLATE_FOLDER } from "@storyflow/backend/constants";
import {
  computeFieldId,
  createFieldId,
  getFieldNumber,
  getTemplateDocumentId,
} from "@storyflow/backend/ids";

type ArticleListMutation =
  | {
      type: "insert";
      id: DocumentId;
      label?: string;
      record: ComputationRecord;
      // values: ValueRecord;
    }
  | {
      type: "remove";
      id: DocumentId;
    };

type ArticleListOperation = {
  folder: FolderId;
  actions: ArticleListMutation[];
};

const queue = createQueue<ArticleListOperation>("documents", {
  clientId: null,
}).initialize(0, []);

const getArticleFromInsert = (
  folder: FolderId,
  action: ArticleListMutation
): DBDocument | undefined => {
  if (action.type !== "insert") return;
  return {
    _id: action.id as DocumentId,
    folder,
    versions: { "": 0 },
    record: action.record,
    config: [],
    ...(action.label && { label: action.label }),
  };
};

const optimisticUpdate = (
  articles: DBDocument[],
  folder: FolderId,
  actions: ArticleListMutation[]
): DBDocument[] => {
  let inserts: DBDocument[] = [];
  let removes: DocumentId[] = [];

  actions.forEach((action) => {
    if (action.type === "insert") {
      inserts.push(getArticleFromInsert(folder, action)!);
    } else {
      removes.push(action.id);
    }
  });

  return [...articles, ...inserts].filter((el) => !removes.includes(el._id));
};

export function useArticleList(folderId: FolderId | undefined) {
  const { data, error } = SWRClient.documents.getList.useQuery(folderId!, {
    inactive: !folderId,
  });

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
  const result = await client.documents.get.query(id, {
    useCache,
  });
  return unwrap(result)?.doc;
}

const TEMPLATES = Object.values(FIELDS).map((el) => {
  const id = getTemplateDocumentId(el.id);

  const template: DBDocument = {
    _id: id,
    folder: TEMPLATE_FOLDER,
    config: [
      {
        id: createFieldId(getFieldNumber(el.id), id),
        type: el.type,
        label: el.label,
      },
    ],
    record: {},
    label: el.label,
  };

  return template;
});

export function useArticle(
  articleId: DocumentId | undefined,
  options: { inactive?: boolean } = {}
) {
  const defaultTemplate = TEMPLATES.find((el) => el._id === articleId);
  if (defaultTemplate) {
    return {
      article: defaultTemplate as DBDocument,
      histories: {},
      mutate: () => {},
      error: undefined,
    };
  }

  const [initialArticle, setInitialArticle] = React.useState(() => {
    const operations: ArticleListOperation[] = [];
    queue.forEach(({ operation }) => {
      operations.push(operation);
    });
    return getArticleFromOperations(articleId, operations);
  });

  const { data, error, mutate } = SWRClient.documents.get.useQuery(
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
    if (data?.doc) {
      return data.doc;
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

export const useArticleListMutation = () => {
  const mutate = SWRClient.documents.sync.useMutation({
    cacheUpdate: (input, mutate) => {
      const groups = input.reduce((acc, cur) => {
        return {
          [cur.folder as FolderId]: [
            ...(acc[cur.folder as FolderId] ?? []),
            ...(cur.actions as ArticleListMutation[]),
          ],
        };
      }, {} as Record<FolderId, ArticleListMutation[]>);

      Object.entries(groups).map(([folder, actions]) => {
        mutate(["getList", folder], (ps, result) => {
          if (result === undefined) {
            // we handle optimistic updates separately
            // so that we do not update the cache
            // on error
            return ps;
          }

          const articles = optimisticUpdate(
            ps.articles,
            folder as FolderId,
            actions
          );

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

export const useSaveArticle = (folder: FolderId) => {
  return SWRClient.fields.save.useMutation({
    cacheUpdate: ({ id }, mutate) => {
      mutate(["documents/getList", folder], (ps, result) => {
        if (!result) {
          return ps;
        }
        const index = ps.articles.findIndex((el) => el._id === id);
        const newArticles = [...ps.articles];
        newArticles[index] = { ...newArticles[index], ...result };
        return {
          articles: newArticles,
        };
      });
      mutate(["documents/get", id], (ps, result) => {
        if (!result) {
          return ps;
        }
        console.log("RESULT", id, result);
        return {
          ...ps,
          doc: result,
          histories: {},
        };
      });
    },
  });
};
