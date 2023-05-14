import { unwrap } from "@storyflow/rpc-client/result";
import React from "react";
import { Client, SWRClient, readFromCache } from "../RPCProvider";
import {
  DocumentId,
  FolderId,
  RawFieldId,
  ValueArray,
  RawDocumentId,
} from "@storyflow/shared/types";
import type { Sorting } from "@storyflow/cms/types";
import type { DBDocument } from "@storyflow/cms/types";
import { normalizeDocumentId } from "@storyflow/cms/ids";
import { useCollab } from "../collab/CollabContext";
import { createDocumentTransformer } from "../operations/apply";
import { TEMPLATES } from "./templates";

export async function fetchDocument(
  id: string,
  client: Client
): Promise<DBDocument | undefined> {
  const defaultTemplate = TEMPLATES.find((el) => el._id === id);
  if (defaultTemplate) {
    return defaultTemplate;
  }

  const result = await client.documents.findById.query(id);
  return unwrap(result);
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

  const key = client.documents.findById.key(id);
  const exists = readFromCache(key);

  if (typeof exists !== "undefined") {
    return {
      then(callback) {
        return callback ? callback(exists.doc) : exists.doc;
      },
    };
  }
  const result = client.documents.findById.query(id).then((res) => unwrap(res));
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

  const { data, error } = SWRClient.documents.findById.useQuery(
    documentId as string,
    {
      inactive: !documentId, // maybe: || Boolean(initialArticle),
      immutable: true,
    }
  );

  return {
    doc: data,
    error: data ? undefined : error,
  };
}

export function useDocumentWithTimeline(documentId: DocumentId) {
  const collab = useCollab();

  React.useLayoutEffect(() => {
    // for prefetching
    console.log("PREFETCHING");
    collab.initializeTimeline(documentId);
    hasCalledStaleHook.current = false;
  }, [collab]);

  const { data, error, mutate } = SWRClient.documents.findById.useQuery(
    documentId,
    {
      immutable: true,
      // only running on fetch, not cache update!
      // onSuccess(data) {}
    }
  );

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
        mutate();
        hasCalledStaleHook.current = true;
      }
    });
  }, [mutate]);

  return {
    doc: data,
    error: data ? undefined : error,
  };
}

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
    await client.documents.find.query(params, {
      cachePreload: (result, preload) => {
        result.forEach((doc) => {
          preload(["findById", doc._id], () => {
            return doc;
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
  const { data, error } = SWRClient.documents.find.useQuery(
    typeof arg === "object" ? arg : { folder: arg!, limit: 50 },
    {
      inactive: typeof arg === "undefined",
      immutable: true,
      cachePreload: (result, preload) => {
        result.forEach((doc) => {
          preload(["findById", doc._id], () => {
            return doc;
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

  return { documents: data, error };
}
