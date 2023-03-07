import { store } from "../../state/state";
import { calculateSync } from "@storyflow/backend/calculate";
import { context, getContextKey } from "../../state/context";
import { fetchArticle } from "../../articles";
import {
  Computation,
  Value,
  FieldId,
  ComputationRecord,
  Fetcher,
  Filter,
} from "@storyflow/backend/types";
import { getComputationRecord } from "@storyflow/backend/flatten";
import { getDocumentId } from "@storyflow/backend/ids";
import { Client } from "../../client";
import { unwrap } from "@storyflow/result";
import { extendPath } from "@storyflow/backend/extendPath";

export const calculateFn = (
  fieldId: FieldId | string,
  value: Computation,
  {
    imports = {},
    returnFunction = false,
    client,
  }: {
    client: Client;
    imports?: ComputationRecord;
    returnFunction?: boolean;
  }
): Value[] => {
  const getter = (importId: FieldId | string, returnFunction: boolean) => {
    const stateId = returnFunction ? `${importId}#function` : importId;

    if (importId.startsWith("ctx:")) {
      const value = context.use<Value[]>(
        getContextKey(getDocumentId(fieldId as FieldId), importId.slice(4))
      ).value;
      return value ? [value] : [];
    }

    if (importId.indexOf(".") > 0) {
      return store.use<Value[]>(importId).value ?? [];
    }

    const value = imports[importId];

    // if (!value) return store.use<Value[]>(id).value ?? [];
    if (value) {
      return store.use<Value[]>(stateId, () =>
        calculateFn(importId, value, { imports, client, returnFunction })
      ).value;
    }

    const asyncFn = fetchArticle(
      getDocumentId(importId as FieldId),
      client
    ).then((article) => {
      // returning undefined makes sure that the field is not initialized,
      // so that if the field is initialized elsewhere, this field will react to it.
      // (e.g. a not yet saved article)
      if (!article) return undefined;
      const all = getComputationRecord(article, { includeImports: true });
      const value = all[importId as FieldId];
      if (!value) return undefined;
      const fn = () =>
        calculateFn(importId, value, { imports: all, client, returnFunction });
      return fn;
    });

    return store.useAsync(stateId, asyncFn).value ?? [];
  };

  const result = calculateSync(fieldId, value, getter, { returnFunction });
  return result;
};

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
