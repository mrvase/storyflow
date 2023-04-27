import { unwrap } from "@storyflow/result";
import { createQueue } from "@storyflow/state";
import React from "react";
import { Client, SWRClient, cache } from "../client";
import {
  DocumentId,
  FolderId,
  RawFieldId,
  ValueArray,
  RawDocumentId,
} from "@storyflow/shared/types";
import type { SyntaxTreeRecord, Sorting } from "@storyflow/fields-core/types";
import type { DBDocument } from "@storyflow/db-core/types";
import { pushAndRetry } from "../utils/retryOnError";
import {
  DEFAULT_FIELDS,
  generateTemplateId,
  getDefaultValue,
} from "@storyflow/fields-core/default-fields";
import { TEMPLATE_FOLDER } from "@storyflow/fields-core/constants";
import {
  getTemplateDocumentId,
  normalizeDocumentId,
} from "@storyflow/fields-core/ids";
import type { DefaultFieldConfig } from "@storyflow/fields-core/types";

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
      inserts.unshift(getDocumentFromInsert(folder, action)!);
    } else {
      removes.push(action.id);
    }
  });

  return [...inserts, ...documents].filter((el) => !removes.includes(el._id));
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
        result.documents.forEach((doc) => {
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
        result.documents.forEach((doc) => {
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

  const documents = React.useMemo(() => {
    if (!data || !folderId) return undefined;
    const actions = operations
      .filter(({ folder }) => folder === folderId)
      .reduce(
        (acc, { actions }) => [...acc, ...actions],
        [] as DocumentListMutation[]
      );
    return optimisticUpdate(data.documents, folderId, actions);
  }, [folderId, data, operations]);

  return { documents, error };
}

const getDocumentFromOperations = (
  documentId: string | undefined,
  operations: DocumentListOperation[]
) => {
  if (!documentId) return;
  let doc: DBDocument | undefined;
  operations.forEach(({ actions, folder }) => {
    actions.forEach((action) => {
      if (action.type === "insert" && action.id === documentId) {
        doc = getDocumentFromInsert(folder, action)!;
      }
    });
  });
  return doc;
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

const generateTemplateFromDefaultFields = (
  label: string,
  fields: DefaultFieldConfig[]
): DBDocument => {
  const record: SyntaxTreeRecord = {};

  fields.forEach((field) => {
    if (field.initialValue) record[field.id] = getDefaultValue(field);
  });

  return {
    _id: generateTemplateId(),
    folder: TEMPLATE_FOLDER,
    label,
    config: fields.map((field) => ({
      template: getTemplateDocumentId(field.id),
    })),
    record,
    versions: { config: 0 },
  };
};

export const DEFAULT_TEMPLATES = {
  staticPage: generateTemplateFromDefaultFields("Statisk side", [
    DEFAULT_FIELDS.url,
    DEFAULT_FIELDS.layout,
    DEFAULT_FIELDS.page,
  ]),
  dynamicPage: generateTemplateFromDefaultFields("Dynamisk side", [
    DEFAULT_FIELDS.url,
    DEFAULT_FIELDS.params,
    DEFAULT_FIELDS.layout,
    DEFAULT_FIELDS.page,
  ]),
  redirectPage: generateTemplateFromDefaultFields("Viderestilling", [
    DEFAULT_FIELDS.url,
    DEFAULT_FIELDS.redirect,
  ]),
};

const TEMPLATES = [
  ...Object.values(DEFAULT_FIELDS).map((field): DBDocument => {
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
      versions: { config: 0 },
    };
  }),
  ...Object.values(DEFAULT_TEMPLATES),
];

export function useDocument(
  documentId_: RawDocumentId | DocumentId | undefined
) {
  const documentId = documentId_
    ? normalizeDocumentId(documentId_)
    : documentId_;

  const defaultTemplate = TEMPLATES.find((el) => el._id === documentId);

  if (defaultTemplate) {
    return React.useMemo(
      () => ({
        doc: defaultTemplate as DBDocument,
        histories: {},
        mutate: () => {},
        error: undefined,
      }),
      []
    );
  }

  const getInitialDocument = () => {
    const operations: DocumentListOperation[] = [];
    queue.forEach(({ operation }) => {
      operations.push(operation);
    });
    return getDocumentFromOperations(documentId, operations);
  };

  const [initialDocument, setInitialDocument] =
    React.useState(getInitialDocument);

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

  const doc = React.useMemo(() => {
    if (!documentId) return undefined;
    if (data?.doc) {
      return data.doc;
    }
    return initialDocument;
  }, [documentId, data, initialDocument]);

  return {
    doc,
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

          const documents = optimisticUpdate(
            ps.documents,
            folder as FolderId,
            actions
          );

          return {
            ...ps,
            documents,
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
        const index = ps.documents.findIndex((el) => el._id === id);
        const newDocuments = [...ps.documents];
        newDocuments[index] = { ...newDocuments[index], ...result };
        return {
          ...ps,
          documents: newDocuments,
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
