import { store } from "../../state/state";
import { calculate, StateGetter } from "@storyflow/cms/calculate-server";
import { context, getContextKey } from "../../state/context";
import { fetchDocumentList, fetchDocumentSync } from "../../documents";
import {
  FieldId,
  RawFieldId,
  DocumentId,
  ValueArray,
  ClientSyntaxTree,
} from "@storyflow/shared/types";
import type { SyntaxTreeRecord, SyntaxTree } from "@storyflow/cms/types";
import {
  createTemplateFieldId,
  getDocumentId,
  getIdFromString,
  getParentDocumentId,
  getRawFieldId,
} from "@storyflow/cms/ids";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";

type FetcherResult = { _id: DocumentId; record: SyntaxTreeRecord }[];

export const calculateFn = (
  value: SyntaxTree,
  {
    record = {},
    contextDocumentId,
  }: {
    contextDocumentId: DocumentId;
    record?: SyntaxTreeRecord;
  }
): ValueArray | ClientSyntaxTree => {
  const getter: StateGetter = (importer, { tree, external }): any => {
    if (importer.type === "fetch") {
      // we want it to react to updates in the template so that new fields are found
      const template = store.use<FieldId[]>(
        `${importer.value.folder.id}#template`,
        () => []
      ).value;

      // whole calculateFn reacts to filters now

      const filters = Object.fromEntries(
        template.map((id) => {
          const fieldId = createTemplateFieldId(importer.value.folder.id, id);
          const state = store.use<ValueArray | ClientSyntaxTree>(fieldId, () =>
            calculateFn(record[id as FieldId] ?? DEFAULT_SYNTAX_TREE, {
              record,
              contextDocumentId: getParentDocumentId(importer.value.folder.id),
            })
          );
          return [getRawFieldId(fieldId), state.value] as [
            RawFieldId,
            ValueArray
          ];
        })
      );

      const string = JSON.stringify({
        folder: importer.value.folder.folder,
        limit: importer.value.limit,
        sort: importer.value.sort ?? {},
        filters,
      });

      const state = store.use<FetcherResult>(string);

      if (!state.initialized()) {
        const promise = fetchDocumentList(
          {
            folder: importer.value.folder.folder,
            limit: importer.value.limit,
            sort: importer.value.sort ?? [],
            filters,
          },
          importer.value.folder.id
        ); // fetcherStore.get(importId.folder.id, string, client);
        promise.then((result) =>
          state.set(() => {
            // might be aborted, so we need a fallback
            return result ?? [];
          })
        );
      }

      return state.value?.map(({ _id }) => ({ id: _id })) ?? [];
    }

    if (importer.type === "context") {
      const value = context.use<ValueArray>(
        getContextKey(contextDocumentId, importer.value.ctx)
      ).value;
      return value ? [value] : [];
    }

    if (importer.type === "nested") {
      return [{}];
    }

    const importId = importer.value;

    const stateId = tree ? `${importId}#tree` : importId;

    const value = record[importId];

    if (value || !external || importId.endsWith(getIdFromString("data"))) {
      const fn = value
        ? () =>
            tree
              ? value
              : calculateFn(value, {
                  record,
                  contextDocumentId: getDocumentId(importId),
                })
        : undefined;

      return store.use(stateId, fn).value;
    }

    const asyncFn = fetchDocumentSync(getDocumentId(importId)).then((doc) => {
      // returning undefined makes sure that the field is not initialized,
      // so that if the field is initialized elsewhere, this field will react to it.
      // (e.g. a not yet saved article)
      if (!doc) return undefined;
      const value = doc.record[importId as FieldId];
      if (!value) return undefined;

      // TODO when returning tree, I should somehow give access to this record as well.

      const fn = () =>
        tree
          ? value
          : calculateFn(value, {
              record: doc.record,
              contextDocumentId: getDocumentId(importId),
            });
      return fn;
    });

    return store.useAsync(stateId, asyncFn).value;
  };

  if (!value) return [];

  const result = calculate(value, getter);
  return result;
};
