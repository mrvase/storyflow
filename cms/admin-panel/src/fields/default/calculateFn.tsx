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

export const calculateFn = (
  id: FieldId | string,
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
  const getter = (id: FieldId | string, returnFunction: boolean) => {
    const stateId = returnFunction ? `${id}#function` : id;

    if (id.startsWith("ctx:")) {
      return context.use<Value[]>(
        getContextKey(getDocumentId(id as FieldId), id.slice(4))
      ).value;
    }

    if (id.indexOf(".") > 0) {
      return store.use<Value[]>(id).value ?? [];
    }

    const value = imports[id];

    // if (!value) return store.use<Value[]>(id).value ?? [];
    if (value) {
      return store.use<Value[]>(stateId, () =>
        calculateFn(id, value, { imports, client, returnFunction })
      ).value;
    }

    const asyncFn = fetchArticle(getDocumentId(id as FieldId), client).then(
      (article) => {
        // returning undefined makes sure that the field is not initialized,
        // so that if the field is initialized elsewhere, this field will react to it.
        // (e.g. a not yet saved article)
        if (!article) return undefined;
        const all = getComputationRecord(article, { includeImports: true });
        const value = all[id as FieldId];
        if (!value) return undefined;
        const fn = () =>
          calculateFn(id, value, { imports: all, client, returnFunction });
        return fn;
      }
    );

    return store.useAsync(stateId, asyncFn).value ?? [];
  };

  const result = calculateSync(id, value, getter, { returnFunction });
  return result;
};

export const fetchFn = (fetcher: Fetcher, client: Client) => {
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

  if (isFetcherFetchable(fetcher)) {
    return client.articles.getListFromFilters.query(fetcher).then((res) => {
      return unwrap(res, []);
    });
  } else {
    return [];
  }
};
