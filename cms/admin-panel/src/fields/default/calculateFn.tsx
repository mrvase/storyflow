import { store } from "../../state/state";
import {
  calculate,
  FolderFetch,
  StateGetter,
} from "@storyflow/backend/calculate";
import { context, getContextKey } from "../../state/context";
import { fetchDocumentList, fetchArticleSync } from "../../documents";
import {
  FieldId,
  NestedDocumentId,
  RawFieldId,
  DocumentId,
  SyntaxTreeRecord,
  SyntaxTree,
  ValueArray,
  FolderId,
} from "@storyflow/backend/types";
import {
  computeFieldId,
  createTemplateFieldId,
  getDocumentId,
  getRawFieldId,
} from "@storyflow/backend/ids";
import { Client } from "../../client";
import { unwrap } from "@storyflow/result";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";

type FetcherResult = { _id: DocumentId; record: SyntaxTreeRecord }[];

function createPromise<T>() {
  let props: {
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
  } = {} as any;
  const promise = new Promise((res, rej) => {
    props.resolve = res;
    props.reject = rej;
  }) as Promise<T> & typeof props;
  Object.assign(promise, props);
  return promise;
}

function createThrottledFetch<T>(fetcher: (url: string) => Promise<T>) {
  let promise: ReturnType<typeof createPromise<T>> | null = null;
  let result: T | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let currentFetch: string | null = null;
  let url: string | null = null;

  const runFetch = async () => {
    if (!url || !promise) return;
    let fetchId = Math.random().toString(16).slice(2);
    currentFetch = fetchId;
    const newResult = await fetcher(url);
    if (currentFetch === fetchId) {
      promise.resolve(newResult);
      result = newResult;
      promise = null;
    }
  };

  const runDelayedFetch = () => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      runFetch();
      timeout = null;
    }, 250);
  };

  return {
    fetch(newUrl: string) {
      if (url === newUrl && (result || promise))
        return promise ?? (result as Promise<T>);
      if (!promise) {
        promise = createPromise();
      }
      url = newUrl;
      runDelayedFetch();
      return promise as Promise<T>;
    },
  };
}

function createFetcherStore() {
  const results = new Map<
    NestedDocumentId,
    ReturnType<typeof createThrottledFetch<FetcherResult>>
  >();

  return {
    async get(
      id: NestedDocumentId,
      url: string,
      client: Client
    ): Promise<FetcherResult> {
      let result = results.get(id);
      if (!result) {
        result = createThrottledFetch<FetcherResult>(async (url) => {
          const params = JSON.parse(url) as Omit<FolderFetch, "folder"> & {
            folder: FolderId;
            filters: Record<RawFieldId, ValueArray>;
          };
          const result = (await fetchDocumentList(params, client)) ?? [];
          return result.articles;
        });
        results.set(id, result);
      }
      return await result.fetch(url);
    },
  };
}

const fetcherStore = createFetcherStore();

export const calculateFn = (
  fieldId: FieldId | string,
  value: SyntaxTree,
  {
    record = {},
    client,
  }: {
    client: Client;
    record?: SyntaxTreeRecord;
  }
): ValueArray => {
  const getter: StateGetter = (importId, { tree, external }): any => {
    if (typeof importId === "object" && "folder" in importId) {
      // we want it to react to updates in the template so that new fields are found
      const template = store.use<FieldId[]>(
        `${importId.folder.id}#template`,
        () => []
      ).value;

      // whole calculateFn reacts to filters now

      const filters = Object.fromEntries(
        template.map((id) => {
          const fieldId = createTemplateFieldId(importId.folder.id, id);
          const state = store.use<ValueArray>(fieldId, () =>
            calculateFn(
              id as FieldId,
              record[id as FieldId] ?? DEFAULT_SYNTAX_TREE,
              {
                record,
                client,
              }
            )
          );
          return [getRawFieldId(fieldId), state.value] as [
            RawFieldId,
            ValueArray
          ];
        })
      );

      const string = JSON.stringify({
        folder: importId.folder.folder,
        limit: importId.limit,
        sort: importId.sort ?? {},
        filters,
      });

      const state = store.use<FetcherResult>(string);

      if (!state.initialized()) {
        const promise = fetcherStore.get(importId.folder.id, string, client);
        promise.then((result_) => state.set(() => result_));
      }

      return state.value?.map(({ _id }) => ({ id: _id })) ?? [];
    }

    if (typeof importId === "object" && "ctx" in importId) {
      const value = context.use<ValueArray>(
        getContextKey(getDocumentId(fieldId as FieldId), importId.ctx)
      ).value;
      return value ? [value] : [];
    }

    const stateId = tree ? `${importId}#tree` : importId;

    const value = record[importId];

    if (value || !external) {
      const fn = value
        ? () =>
            tree ? value : calculateFn(importId, value, { record, client })
        : undefined;

      return store.use(stateId, fn).value;
    }

    const asyncFn = fetchArticleSync(
      getDocumentId(importId as FieldId),
      client
    ).then((article) => {
      // returning undefined makes sure that the field is not initialized,
      // so that if the field is initialized elsewhere, this field will react to it.
      // (e.g. a not yet saved article)
      if (!article) return undefined;
      const value = article.record[importId as FieldId];
      if (!value) return undefined;

      // TODO when returning tree, I should somehow give access to this record as well.

      const fn = () =>
        tree
          ? value
          : calculateFn(importId, value, {
              record: article.record,
              client,
            });
      return fn;
    });

    return store.useAsync(stateId, asyncFn).value;
  };

  if (!value) return [];

  const result = calculate(value, getter);
  return result;
};

/*
export const fetchFn = (path: string, fetcher: Fetcher, client: Client) => {
  const isFetcherFetchable = (
    fetcher: Fetcher
  ): fetcher is Fetcher & {
    filters: {
      field: Exclude<Filter["field"], "">;
      operation: Exclude<Filter["operation"], "">;
      value: Computation;
    }[];
  } => {
    return (
      fetcher.filters.length > 0 &&
      fetcher.filters.every(
        (el: Filter) =>
          el.value.length > 0 &&
          ![el.field, el.operation].some((el: any) =>
            ["", null, undefined].includes(el)
          )
      )
    );
  };

  const reactiveFetcher: Fetcher = {
    ...fetcher,
    filters: fetcher.filters.map((filter, index) => ({
      ...filter,
      value:
        store.use<Value[]>(extendPath(path, `${index}`, "/")).value ??
        filter.value,
    })),
  };

  console.log("FETCHER", fetcher, reactiveFetcher);

  if (isFetcherFetchable(reactiveFetcher)) {
    return client.articles.getListFromFilters
      .query(reactiveFetcher)
      .then((res) => {
        return unwrap(res, []);
      });
  } else {
    return [];
  }
};
*/
