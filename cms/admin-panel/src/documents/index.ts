import React from "react";
import {
  DocumentId,
  FolderId,
  RawFieldId,
  ValueArray,
  RawDocumentId,
  Sorting,
  ClientSyntaxTree,
  FieldId,
} from "@storyflow/shared/types";
import type { DBDocument } from "@storyflow/cms/types";
import {
  createTemplateFieldId,
  getDocumentId,
  normalizeDocumentId,
} from "@storyflow/cms/ids";
import { collab } from "../collab/CollabContext";
import { createDocumentTransformer } from "../operations/apply";
import { TEMPLATES } from "./templates";
import { query } from "../clients/client";
import { cache, useImmutableQuery } from "@nanorpc/client/swr";
import { isError } from "@nanorpc/client";
import { getFolder } from "../folders/FoldersContext";
import { configs } from "./document-config";
import { getTemplateFieldsAsync } from "./template-fields";
import { store } from "../state/state";
import { ValueRecord } from "../fields/FieldPage";

export async function fetchDocument(
  id: string
): Promise<DBDocument | undefined> {
  const defaultTemplate = TEMPLATES.find((el) => el._id === id);
  if (defaultTemplate) {
    return defaultTemplate;
  }

  const result = await query.documents.findById(id);
  if (isError(result)) return undefined;
  return result;
}

export function fetchDocumentSync(
  id: string
): PromiseLike<DBDocument | undefined> {
  const defaultTemplate = TEMPLATES.find((el) => el._id === id) as any;

  if (defaultTemplate) {
    return {
      then(callback) {
        return callback ? callback(defaultTemplate) : defaultTemplate;
      },
    };
  }

  const exists = cache.read(query.documents.findById(id));

  if (typeof exists !== "undefined") {
    return {
      then(callback) {
        return callback ? callback(exists) : (exists as any);
      },
    };
  }
  const result = query.documents
    .findById(id)
    .then((res) => (isError(res) ? undefined : res));
  return result;
}

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
        timeline: [],
        mutate: () => {},
        error: undefined,
      }),
      []
    );
  }

  const { data, error } = useImmutableQuery(
    documentId ? query.documents.findById(documentId) : undefined
  );

  return {
    doc: data,
    error: data ? undefined : error,
  };
}

export function useDocumentWithTimeline(documentId: DocumentId) {
  React.useLayoutEffect(() => {
    // for prefetching
    console.log("PREFETCHING");
    collab.initializeTimeline(documentId);
    hasCalledStaleHook.current = false;
  }, []);

  const doc = useImmutableQuery(query.documents.findById(documentId));

  const data = doc.data;

  React.useLayoutEffect(() => {
    // TODO: This should be made synchronous to avoid flickering
    if (!data) return;

    console.log("UPDATED! ON STALE?", hasCalledStaleHook.current, documentId);

    collab.initializeTimeline(documentId, {
      versions: data.versions,
      transform: createDocumentTransformer(data),
    });

    hasCalledStaleHook.current = false;
  }, [data]);

  let hasCalledStaleHook = React.useRef(false);
  React.useEffect(() => {
    const timeline = collab.getTimeline(documentId)!;
    return timeline.registerStaleListener(() => {
      if (!hasCalledStaleHook.current) {
        doc.revalidate();
        hasCalledStaleHook.current = true;
      }
    });
  }, [doc.revalidate]);

  return {
    doc: data,
    error: data ? undefined : doc.error,
  };
}

export async function fetchDocumentList(
  params: {
    folder: FolderId;
    limit: number;
    sort?: Sorting[];
    filters?: Record<RawFieldId, ValueArray>;
  },
  throttleKey?: string
) {
  const result = await query.documents.find(params, {
    onSuccess(result) {
      result.forEach((doc) => {
        cache.set(query.documents.findById(doc._id), (ps) => (ps ? ps : doc));
      });
    },
    throttle: throttleKey
      ? {
          key: throttleKey,
          ms: 250,
        }
      : undefined,
  });

  if (isError(result)) return undefined;

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
  const getPromise = () => {
    if (!arg) return;

    return query.documents.find(
      typeof arg === "object" ? arg : { folder: arg, limit: 150 },
      {
        onSuccess(result) {
          result.forEach((doc) => {
            cache.set(query.documents.findById(doc._id), (ps) =>
              ps ? ps : doc
            );
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
  };

  const { data, ...rest } = useImmutableQuery(getPromise());

  return { documents: data, ...rest };
}

export const getUpdatedValueRecord = async (
  documentId: DocumentId
): Promise<Record<FieldId, { label: string; value: ValueArray }>> => {
  const folderId = (await fetchDocument(documentId))?.folder;
  const templateId = folderId ? getFolder(folderId)?.template : undefined;
  const ownConfig = configs.get(documentId);
  const templateConfig = templateId
    ? configs.get(templateId) ?? (await fetchDocument(templateId))?.config
    : undefined;
  const fields = await getTemplateFieldsAsync([
    ...(ownConfig ?? []),
    ...(templateConfig ?? []),
  ]);
  const entries = fields.map(
    ({ id, label }): [FieldId, { label: string; value: ValueArray }] => {
      const ownId =
        getDocumentId(id) === documentId
          ? id
          : createTemplateFieldId(documentId, id);
      const value = store.use<ValueArray | ClientSyntaxTree>(ownId).value;
      return [ownId, { label, value: Array.isArray(value) ? value : [] }];
    }
  );

  return Object.fromEntries(entries);
};
