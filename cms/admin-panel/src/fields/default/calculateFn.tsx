import { store } from "../../state/state";
import { calculate } from "@storyflow/backend/calculate";
import { context, getContextKey } from "../../state/context";
import { fetchArticle } from "../../articles";
import {
  Computation,
  Value,
  FieldId,
  ComputationRecord,
} from "@storyflow/backend/types";
import { getComputationRecord } from "@storyflow/backend/flatten";
import { getDocumentId } from "@storyflow/backend/ids";
import { Client } from "../../client";

export const calculateFn = (
  id: FieldId,
  value: Computation,
  imports: ComputationRecord = {},
  client: Client
): Value[] => {
  const getter = (id: FieldId) => {
    if (id.startsWith("ctx:")) {
      return context.use<Value[]>(getContextKey(getDocumentId(id), id.slice(4)))
        .value;
    }

    if (id.indexOf(".") > 0) {
      return store.use<Value[]>(id).value ?? [];
    }

    const value = imports[id];

    // if (!value) return store.use<Value[]>(id).value ?? [];
    if (value) {
      const fn = () => calculateFn(id, value, imports, client);
      return store.use<Value[]>(id, fn).value;
    }

    const asyncFn = fetchArticle(getDocumentId(id), client).then((article) => {
      // returning undefined makes sure that the field is not initialized,
      // so that if the field is initialized elsewhere, this field will react to it.
      // (e.g. a not yet saved article)
      if (!article) return undefined;
      const all = getComputationRecord(article, { includeImports: true });
      const value = all[id as FieldId];
      if (!value) return undefined;
      const fn = () => calculateFn(id, value, all, client);
      return fn;
    });

    return store.useAsync(id, asyncFn).value ?? [];
  };

  const result = calculate(id, value, getter);
  return result;
};
