import { unwrap } from "@storyflow/result";
import { createQueue } from "@storyflow/state";
import React from "react";
import { Client, SWRClient, cache } from "../client";
import {
  SyntaxTreeRecord,
  DBDocument,
  DocumentId,
  FolderId,
  RawFieldId,
  ValueArray,
  Sorting,
} from "@storyflow/backend/types";
import { pushAndRetry } from "../utils/retryOnError";
import {
  DEFAULT_FIELDS,
  DEFAULT_TEMPLATES,
  getDefaultValue,
} from "@storyflow/backend/fields";
import { TEMPLATE_FOLDER } from "@storyflow/backend/constants";
import { getTemplateDocumentId } from "@storyflow/backend/ids";

type DocumentListMutation =
  | {
      type: "insert";
      id: DocumentId;
      label?: string;
      record: SyntaxTreeRecord;
      // values: ValueRecord;
    }
  | {
      type: "remove";
      id: DocumentId;
    };

type DocumentListOperation = {
  folder: FolderId;
  actions: DocumentListMutation[];
};

const queue = createQueue<DocumentListOperation>("documents", {
  clientId: null,
}).initialize(0, []);

const getDocumentFromInsert = (
  folder: FolderId,
  action: DocumentListMutation
): DBDocument | undefined => {
  if (action.type !== "insert") return;
  return {
    _id: action.id as DocumentId,
    folder,
    versions: { config: 0 },
    record: action.record,
    config: [],
    ...(action.label && { label: action.label }),
  };
};

const optimisticUpdate = (
  documents: DBDocument[],
  folder: FolderId,
  actions: DocumentListMutation[]
): DBDocument[] => {
  let inserts: DBDocument[] = [];
  let removes: DocumentId[] = [];

  actions.forEach((action) => {
    if (action.type === "insert") {
      inserts.push(getDocumentFromInsert(folder, action)!);
    } else {
      removes.push(action.id);
    }
  });

  return [...documents, ...inserts].filter((el) => !removes.includes(el._id));
};

export async function fetchDocumentList(
  params: {
    folder: FolderId;
    limit: number;
    sort?: Sorting[];
    filters?: Record<RawFieldId, ValueArray>;
  },
  client: Client,
  throttleKey?: string
) {
  const result = unwrap(
    await client.documents.getList.query(params, {
      cachePreload: (result, preload) => {
        result.articles.forEach((doc) => {
          preload(["get", doc._id], () => {
            return {
              doc,
              histories: result.historiesRecord[doc._id],
            };
          });
        });
      },
      throttle: throttleKey
        ? {
            key: throttleKey,
            ms: 250,
          }
        : undefined,
    })
  );

  return result;
}

export function useDocumentList(
  arg:
    | {
        folder: FolderId;
        limit: number;
        sort?: Sorting[];
        filters?: Record<RawFieldId, ValueArray>;
      }
    | FolderId
    | undefined,
  throttleKey?: string
) {
  const { data, error } = SWRClient.documents.getList.useQuery(
    typeof arg === "object" ? arg : { folder: arg!, limit: 50 },
    {
      inactive: typeof arg === "undefined",
      immutable: true,
      cachePreload: (result, preload) => {
        result.articles.forEach((doc) => {
          preload(["get", doc._id], () => {
            return {
              doc,
              histories: result.historiesRecord[doc._id],
            };
          });
        });
      },
      throttle: throttleKey
        ? {
            key: throttleKey,
            ms: 250,
          }
        : undefined,
    }
  );

  return { data, error };
}

export function useOptimisticDocumentList(folderId: FolderId | undefined) {
  const { data, error } = useDocumentList(folderId);

  const [operations, setOperations] = React.useState<DocumentListOperation[]>(
    []
  );

  React.useEffect(() => {
    return queue.register(({ forEach }) => {
      const newOps: DocumentListOperation[] = [];
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
        [] as DocumentListMutation[]
      );
    return optimisticUpdate(data.articles, folderId, actions);
  }, [folderId, data, operations]);

  return { articles, error };
}

const getDocumentFromOperations = (
  documentId: string | undefined,
  operations: DocumentListOperation[]
) => {
  if (!documentId) return;
  let article: DBDocument | undefined;
  operations.forEach(({ actions, folder }) => {
    actions.forEach((action) => {
      if (action.type === "insert" && action.id === documentId) {
        article = getDocumentFromInsert(folder, action)!;
      }
    });
  });
  return article;
};

export async function fetchDocument(
  id: string,
  client: Client
): Promise<DBDocument | undefined> {
  const defaultTemplate = TEMPLATES.find((el) => el._id === id);
  if (defaultTemplate) {
    return defaultTemplate;
  }

  const result = await client.documents.get.query(id);
  return unwrap(result)?.doc;
}

export function fetchDocumentSync(
  id: string,
  client: Client
): PromiseLike<DBDocument | undefined> {
  const defaultTemplate = TEMPLATES.find((el) => el._id === id) as any;

  if (defaultTemplate) {
    return {
      then(callback) {
        return callback ? callback(defaultTemplate) : defaultTemplate;
      },
    };
  }

  const key = client.documents.get.key(id);
  const exists = cache.read(key);
  if (typeof exists !== "undefined") {
    return {
      then(callback) {
        return callback ? callback(exists.doc) : exists.doc;
      },
    };
  }
  const result = client.documents.get.query(id).then((res) => unwrap(res)?.doc);
  return result;
}

const TEMPLATES = [
  ...Object.values(DEFAULT_FIELDS).map((field) => {
    let { initialValue, ...fieldConfig } = field as typeof field & {
      initialValue?: any;
    };

    const record: SyntaxTreeRecord = {};
    if ("initialValue" in field) {
      record[field.id] = getDefaultValue(field);
    }

    return {
      _id: getTemplateDocumentId(field.id),
      folder: TEMPLATE_FOLDER,
      label: field.label,
      config: [fieldConfig],
      record,
    };
  }),
  ...Object.values(DEFAULT_TEMPLATES),
];

export function useDocument(documentId: DocumentId | undefined) {
  const defaultTemplate = TEMPLATES.find((el) => el._id === documentId);

  if (defaultTemplate) {
    return React.useMemo(
      () => ({
        article: defaultTemplate as DBDocument,
        histories: {},
        mutate: () => {},
        error: undefined,
      }),
      []
    );
  }

  const [initialDocument, setInitialDocument] = React.useState(() => {
    const operations: DocumentListOperation[] = [];
    queue.forEach(({ operation }) => {
      operations.push(operation);
    });
    return getDocumentFromOperations(documentId, operations);
  });

  const { data, error, mutate } = SWRClient.documents.get.useQuery(
    documentId as string,
    {
      inactive: !documentId, // maybe: || Boolean(initialArticle),
    }
  );

  React.useEffect(() => {
    if (initialDocument !== undefined && data !== undefined) {
      setInitialDocument(undefined);
    }
  }, [initialDocument, data]);

  const article = React.useMemo(() => {
    if (!documentId) return undefined;
    if (data?.doc) {
      return data.doc;
    }
    return initialDocument;
  }, [documentId, data, initialDocument]);

  return {
    article,
    histories: data?.histories ?? {},
    mutate,
    error: initialDocument ? undefined : error,
  };
}

export const useDocumentListMutation = () => {
  const mutate = SWRClient.documents.sync.useMutation({
    cacheUpdate: (input, mutate) => {
      const groups = input.reduce((acc, cur) => {
        return {
          [cur.folder as FolderId]: [
            ...(acc[cur.folder as FolderId] ?? []),
            ...(cur.actions as DocumentListMutation[]),
          ],
        };
      }, {} as Record<FolderId, DocumentListMutation[]>);

      Object.entries(groups).map(([folder, actions]) => {
        mutate(["getList", { folder, limit: 50 }], (ps, result) => {
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
            ...ps,
            articles,
          };
        });
      });
    },
  });

  return (operation: DocumentListOperation) => {
    pushAndRetry("documents", operation, mutate, queue);
  };
};

export const useSaveDocument = (folder: FolderId) => {
  return SWRClient.fields.save.useMutation({
    cacheUpdate: ({ id }, mutate) => {
      mutate(["documents/getList", { folder, limit: 50 }], (ps, result) => {
        if (!result) {
          return ps;
        }
        const index = ps.articles.findIndex((el) => el._id === id);
        const newDocuments = [...ps.articles];
        newDocuments[index] = { ...newDocuments[index], ...result };
        return {
          ...ps,
          articles: newDocuments,
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
