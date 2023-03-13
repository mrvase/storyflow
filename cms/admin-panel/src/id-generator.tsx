import { unwrap } from "@storyflow/result";
import React from "react";
import { SWRClient, useClient } from "./client";
import {
  DocumentId,
  FolderId,
  NestedDocumentId,
} from "@storyflow/backend/types";
import { useUrlInfo } from "./users";
import { z } from "zod";
import {
  getRawDocumentId,
  createFieldId,
  createDocumentId,
} from "@storyflow/backend/ids";

/*
[organisation]:ids {
  workspace: string;
  id_offset: number;
  id_counter: number;
  template_offset: number;
  template_counter: number;
  field_offset: number;
  field_counter: number;
  docs: string[];
}
[organisation]:[raw_document_id] number
*/

const batchSizes = {
  id: 50,
  template: 3,
  field: 5,
};

const schema = z.object({
  workspace: z.string(),
  id: z.number(),
  template: z.number(),
  id_offsets: z.array(z.number()),
  template_offsets: z.array(z.number()),
  field_offsets: z.array(z.number()),
  docs: z.array(z.string()),
});

const getNextValue = (
  offsets: number[],
  batchSize: number,
  counter: number
): [result: number, shouldFetch: boolean] => {
  /* 
  counter: 15
  offsets: [500, 0]
  should return: 16

  counter: 99
  offsets: [500, 0]
  should return: 500
  */
  const next = counter + 1;

  const base = Math.floor(next / batchSize) * batchSize;

  const offsetIndex = offsets.findIndex((offset) => base > offset);
  const offset = offsets[offsetIndex];

  if (base !== offset) {
    if (offsetIndex <= 0) {
      throw new Error("No more ids available");
    }
    const nextOffset = offsets[offsetIndex - 1];
    return [nextOffset + (next % batchSize), nextOffset === 0];
  }

  return [next, offset === 0];
};

const IdContext = React.createContext<{
  getDocumentNumber: () => number;
  getTemplateNumber: () => number;
  getFieldNumber: (documentId: DocumentId) => number;
} | null>(null);

export function IdGenerator({ children }: { children: React.ReactNode }) {
  const { organization } = useUrlInfo();

  const { data: workspaceId } = SWRClient.ids.getWorkspaceId.useQuery();

  const getName = (name: string) => `${organization}:${name}`;

  const getItem = (name: string): string | null => {
    if (!workspaceId) {
      throw new Error("Tried to get value before initialization");
    }
    if (typeof window === "undefined") return null;
    return localStorage.getItem(name) ?? null;
  };

  const initialize = async () => {
    if (getObject()) return;
    const id_offset = await fetchOffset("id");
    const template_offset = await fetchOffset("template");
    const field_offset = await fetchOffset("field");
    const object = {
      workspace: workspaceId,
      id: id_offset,
      template: template_offset,
      id_offsets: [id_offset],
      template_offsets: [template_offset],
      field_offsets: [field_offset],
      docs: [],
    };
    localStorage.setItem(getName("ids"), JSON.stringify(object));
  };

  const getObject = () => {
    const string = getItem(getName("ids"));
    if (!string) return null;
    try {
      const value = schema.parse(JSON.parse(string));
      if (value.workspace !== workspaceId) {
        throw new Error("Workspace mismatch");
      }
      return value;
    } catch (err) {
      console.error(err);
      localStorage.removeItem(getName("ids"));
      return null;
    }
  };

  const getObjectOrError = () => {
    const object = getObject();
    if (!object) {
      throw new Error("Object not found");
    }
    return object;
  };

  const getCounterValue = (name: "id" | "template") => {
    const object = getObjectOrError();
    const counter = object[name];
    const offsets = object[`${name}_offsets`];
    const [nextValue, shouldFetch] = getNextValue(
      offsets,
      batchSizes[name],
      counter
    );
    if (shouldFetch) fetchOffset(name);
    localStorage.setItem(
      getName(name),
      JSON.stringify({
        ...object,
        [name]: nextValue,
      })
    );
    return nextValue;
  };

  const getDocumentNumber = () => {
    return getCounterValue("id");
  };

  const getTemplateNumber = () => {
    return getCounterValue("template");
  };

  const getFieldNumber = (documentId: DocumentId) => {
    const object = getObjectOrError();

    const docs = object.docs;

    const rawId = getRawDocumentId(documentId);

    const exists = docs.includes(rawId);

    const offsets = object.field_offsets;

    let value: number;

    if (exists) {
      const string = getItem(getName(rawId));
      if (!string) {
        throw new Error("Field number should exist but was not found");
      }
      const counter = parseInt(string);
      const [nextValue, shouldFetch] = getNextValue(
        offsets,
        batchSizes.field,
        counter
      );

      if (shouldFetch) fetchOffset("field");

      value = nextValue;
    } else {
      docs.push(rawId);
      value = offsets[offsets.length - 1];
    }

    localStorage.setItem(getName(rawId), value.toString());
    localStorage.setItem(
      getName("ids"),
      JSON.stringify({
        ...object,
        docs,
      })
    );

    return value;
  };

  const promises = React.useRef({
    id: null as (Promise<void> & { abort: () => void }) | null,
    template: null as (Promise<void> & { abort: () => void }) | null,
    field: null as (Promise<void> & { abort: () => void }) | null,
  });

  const client = useClient();

  const fetchOffset = async (name: "id" | "template" | "field") => {
    if (!promises.current[name]) {
      const promise = client.ids.getOffset.query({
        name,
        size: batchSizes[name],
      });

      const promiseExtended = promise
        .then((result) => {
          if (promises.current[name]) {
            // don't do anything if component is unmounted.
            const object = getObjectOrError();
            localStorage.setItem(
              getName("ids"),
              JSON.stringify({
                ...object,
                [`${name}_offsets`]: [
                  result.result,
                  ...object[`${name}_offsets`],
                ],
              })
            );
          }
        })
        .finally(() => {
          promises.current[name] = null;
        });

      const abortablePromise = Object.assign(promiseExtended, {
        abort() {
          promise.abort();
        },
      });

      promises.current[name] = abortablePromise;
    }
    return await promises.current[name];
  };

  React.useEffect(() => {
    if (!workspaceId) return;
    initialize();
    return () => {
      promises.current.id?.abort();
      promises.current.id = null;
      promises.current.template?.abort();
      promises.current.template = null;
      promises.current.field?.abort();
      promises.current.field = null;
    };
  }, [workspaceId]);

  const ctx = React.useMemo(
    () => ({
      getDocumentNumber,
      getTemplateNumber,
      getFieldNumber,
    }),
    [workspaceId]
  );

  if (!workspaceId) {
    return null;
  }

  return <IdContext.Provider value={ctx}>{children}</IdContext.Provider>;
}

export const useFolderIdGenerator = () => {
  const ctx = React.useContext(IdContext);
  if (!ctx) throw Error("No IdContext.Provider");
  return React.useCallback(
    () => createDocumentId(ctx.getDocumentNumber()) as unknown as FolderId,
    [ctx]
  );
};

export const useDocumentIdGenerator = () => {
  const ctx = React.useContext(IdContext);
  if (!ctx) throw Error("No IdContext.Provider");
  return React.useCallback(
    ((parent?: DocumentId) => {
      if (parent) {
        return createDocumentId(ctx.getDocumentNumber(), parent);
      }
      return createDocumentId(ctx.getDocumentNumber());
    }) as {
      (): DocumentId;
      (parent: DocumentId): NestedDocumentId;
    },
    [ctx]
  );
};

export const useTemplateIdGenerator = () => {
  const ctx = React.useContext(IdContext);
  if (!ctx) throw Error("No IdContext.Provider");
  return React.useCallback(
    () => createDocumentId(ctx.getTemplateNumber()),
    [ctx]
  );
};

export const useFieldIdGenerator = () => {
  const ctx = React.useContext(IdContext);
  if (!ctx) throw Error("No IdContext.Provider");
  return React.useCallback(
    (documentId: DocumentId) =>
      createFieldId(ctx.getFieldNumber(documentId), documentId),
    [ctx]
  );
};
