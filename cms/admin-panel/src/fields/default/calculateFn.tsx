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
} from "@storyflow/backend/types";
import { getDocumentId } from "@storyflow/backend/ids";
import { Client } from "../../client";

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
      return [];
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
