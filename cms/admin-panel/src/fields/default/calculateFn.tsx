import { store } from "../../state/state";
import { calculateSync, FetchObject } from "@storyflow/backend/calculate";
import { context, getContextKey } from "../../state/context";
import { fetchArticle } from "../../documents";
import {
  Computation,
  Value,
  FieldId,
  ComputationRecord,
  ContextToken,
  NestedDocumentId,
  FolderId,
  RawFieldId,
  SortSpec,
  DBFolder,
  DocumentId,
} from "@storyflow/backend/types";
import {
  computeFieldId,
  createRawTemplateFieldId,
  createTemplateFieldId,
  getDocumentId,
  getRawDocumentId,
  getRawFieldId,
} from "@storyflow/backend/ids";
import { Client } from "../../client";
import { fetchFolder } from "../../folders";
import { getTemplateFieldsAsync } from "../../documents/template-fields";
import { unwrap } from "@storyflow/result";

type FetcherResult = { _id: DocumentId; record: ComputationRecord }[];

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
          const params = JSON.parse(url) as Omit<FetchObject, "id"> & {
            filters: Record<RawFieldId, Value[]>;
          };
          const result = unwrap(
            await client.documents.getListFromFilters.query(params),
            []
          );
          console.log("RESULT", result);
          return result;
          /*
          return [
            {
              id: "abc0" as FieldId,
              record: { ["abc0" as FieldId]: ["hej"] } as ComputationRecord,
            },
            {
              id: "abc1" as FieldId,
              record: { ["abc1" as FieldId]: ["med"] } as ComputationRecord,
            },
            {
              id: "abc2" as FieldId,
              record: { ["abc2" as FieldId]: ["dig"] } as ComputationRecord,
            },
          ];
          const response = await fetch(url);
          return response.json();
          */
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
  value: Computation,
  {
    record = {},
    returnFunction = false,
    client,
  }: {
    client: Client;
    record?: ComputationRecord;
    returnFunction?: boolean;
  }
): Value[] => {
  const getter = (
    importId: FieldId | FetchObject | ContextToken,
    {
      returnFunction,
      external,
    }: {
      returnFunction?: boolean;
      external?: boolean;
    } = {}
  ) => {
    if (typeof importId === "object" && "select" in importId) {
      // we want it to react to updates in the template so that new fields are found
      const template = store.use<FieldId[]>(
        `${importId.id}#template`,
        () => []
      ).value;

      // whole calculateFn reacts to filters now

      const filters = Object.fromEntries(
        template.map((id) => {
          const fieldId = createTemplateFieldId(importId.id, id);
          const state = store.use<Value[]>(fieldId, () =>
            calculateFn(id as FieldId, record[id as FieldId] ?? [], {
              record,
              client,
              returnFunction: false,
            })
          );
          return [getRawFieldId(fieldId), state.value] as [RawFieldId, Value[]];
        })
      );

      /*
      const filtersState = store.useMany(
        new RegExp(`^${getRawDocumentId(importId.id)}[^\\#]+$`),
        (id) =>
          calculateFn(id as FieldId, record[id as FieldId] ?? [], {
            record,
            client,
            returnFunction: false,
          })
      );
      const filters = filtersState.reduce((acc, [id, state]) => {
        return { ...acc, [id]: state.value };
      }, {} as Record<RawFieldId, Value[]>);
      */

      const string = JSON.stringify({
        folder: importId.folder,
        limit: importId.limit,
        sortBy: importId.sortBy ?? {},
        filters,
      });

      const state = store.use<FetcherResult>(string);

      if (!state.initialized()) {
        const promise = fetcherStore.get(importId.id, string, client);
        promise.then((result_) => state.set(() => result_));
      }

      const values = (state.value ?? []).reduce((acc, { _id, record }) => {
        const fieldId = computeFieldId(_id, importId.select);
        const value = record[fieldId] ?? [];
        const state = store.use<Value[]>(fieldId, () =>
          calculateFn(fieldId, value, {
            record,
            client,
            returnFunction: false,
          })
        ).value;
        if (state.length > 1) {
          return [...acc, state];
        } else if (state.length === 1) {
          return [...acc, state[0]];
        }
        return acc;
      }, [] as Value[]);

      return values ?? [];
    }

    if (typeof importId === "object" && "ctx" in importId) {
      const value = context.use<Value[]>(
        getContextKey(getDocumentId(fieldId as FieldId), importId.ctx)
      ).value;
      return value ? [value] : [];
    }

    const stateId = returnFunction ? `${importId}#function` : importId;

    if (importId.indexOf(".") > 0) {
      return store.use<Value[]>(importId).value ?? [];
    }

    const value = record[importId];

    // if (!value) return store.use<Value[]>(id).value ?? [];
    if (value) {
      return store.use<Value[]>(stateId, () =>
        calculateFn(importId, value, { record, client, returnFunction })
      ).value;
    } else if (!external) {
      return store.use<Value[]>(stateId).value ?? [];
    }

    const asyncFn = fetchArticle(
      getDocumentId(importId as FieldId),
      client
    ).then((article) => {
      // returning undefined makes sure that the field is not initialized,
      // so that if the field is initialized elsewhere, this field will react to it.
      // (e.g. a not yet saved article)
      if (!article) return undefined;
      const value = article.record[importId as FieldId];
      if (!value) return undefined;
      const fn = () =>
        calculateFn(importId, value, {
          record: article.record,
          client,
          returnFunction,
        });
      return fn;
    });

    return store.useAsync(stateId, asyncFn).value ?? [];
  };

  const result = calculateSync(value, getter, { returnFunction });
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
