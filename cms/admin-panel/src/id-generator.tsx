import React from "react";
import {
  DocumentId,
  FolderId,
  NestedDocumentId,
} from "@storyflow/shared/types";
import {
  getRawDocumentId,
  createFieldId,
  createDocumentId,
  USER_DOCUMENT_OFFSET,
  USER_TEMPLATE_OFFSET,
} from "@storyflow/cms/ids";
import { useOrganization } from "./clients/auth";
import { mutate, query } from "./clients/client";
import { isError } from "@nanorpc/client";
import { z } from "./utils/parse";

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
  workspace: "string",
  id: "number",
  template: "number",
  id_offsets: z.array("number"),
  template_offsets: z.array("number"),
  field_offsets: z.array("number"),
  docs: z.array("string"),
});

const getNextValue = (
  offsets: number[],
  batchSize: number,
  counter: number
): [result: number | null, shouldFetch: boolean] => {
  /* 
  counter: 15
  offsets: [500, 0]
  should return: 16

  counter: 99
  offsets: [500, 0]
  should return: 500
  */

  // NOTE
  // it does not use the exact offset value. The first value returned is always the counter + 1.
  // (and the counter begins at the first offset).
  // and it is only when the counter *surpasses* (and not when it equals) the offset + batchSize
  // that it continues to the next offset + 1. That is, the exact offset value belongs to the previous
  // batch.

  const next = counter + 1;

  const offsetIndex = offsets.findIndex((offset) => next >= offset);
  const offset = offsets[offsetIndex];

  if (offsetIndex < 0) {
    // this is technically not possible if there is at minimum one offset
    return [null, true];
  }

  if (next > offset + batchSize) {
    // it should use the next offset

    if (offsetIndex === 0) {
      // we have reached the end of the latest batch and we must fetch the next batch
      return [null, true];
    }

    // the next batch is available so we use its offset + 1
    const nextOffset = offsets[offsetIndex - 1] + 1;
    return [nextOffset, nextOffset === 1];
  }

  return [next, offsetIndex === 0];
};

const IdContext = React.createContext<{
  getDocumentNumber: () => number;
  getTemplateNumber: () => number;
  getFieldNumber: (documentId: DocumentId) => number;
} | null>(null);

const createIdManager = ({
  slug,
  workspace,
}: {
  slug: string;
  workspace: string;
}) => {
  const getName = (name: string = "ids") => `${slug}:${name}`;

  const getItem = (name: string): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(name) ?? null;
  };

  let initialized: boolean = false;

  const fetchOffset = async (name: "id" | "template" | "field") => {
    return mutate.admin
      .getOffset({
        name,
        size: batchSizes[name],
      })
      .then((result) => {
        if (isError(result)) {
          throw new Error(result.error);
        }
        return result;
      });
  };

  const initialize = () => {
    if (initialized) return;
    initialized = true;
    if (getObject()) return;
    const createObject = async () => {
      const [id_offset, template_offset, field_offset] = await Promise.all([
        fetchOffset("id"),
        fetchOffset("template"),
        fetchOffset("field"),
      ]);
      return {
        workspace,
        id: id_offset,
        template: template_offset,
        id_offsets: [id_offset],
        template_offsets: [template_offset],
        field_offsets: [field_offset],
        docs: [],
      };
    };
    createObject()
      .then((object) => {
        localStorage.setItem(getName(), JSON.stringify(object));
      })
      .catch(console.error);
  };

  const getObject = () => {
    const string = getItem(getName());
    if (!string) return null;
    try {
      const value = schema.parse(JSON.parse(string)) as {
        workspace: string;
        id: number;
        template: number;
        id_offsets: number[];
        template_offsets: number[];
        field_offsets: number[];
        docs: string[];
      };
      if (value.workspace !== workspace) {
        throw new Error("Workspace mismatch");
      }
      return value;
    } catch (err) {
      console.error(err);
      localStorage.removeItem(getName());
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
    if (shouldFetch) {
      fetchOffset(name).then((offset) => commitOffset(name, offset));
    }
    if (!nextValue) {
      throw new Error("No more ids available");
    }
    localStorage.setItem(
      getName(),
      JSON.stringify({
        ...object,
        [name]: nextValue,
      })
    );
    return nextValue;
  };

  const getDocumentNumber = () => {
    return getCounterValue("id") + USER_DOCUMENT_OFFSET;
  };

  const getTemplateNumber = () => {
    return getCounterValue("template") + USER_TEMPLATE_OFFSET;
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

      if (shouldFetch) {
        fetchOffset("field").then((offset) => commitOffset("field", offset));
      }

      if (!nextValue) {
        throw new Error("No more ids available");
      }

      value = nextValue;
    } else {
      docs.push(rawId);
      value = offsets[offsets.length - 1];
    }

    localStorage.setItem(getName(rawId), value.toString());
    localStorage.setItem(
      getName(),
      JSON.stringify({
        ...object,
        docs,
      })
    );

    return value;
  };

  const commitOffset = (
    name: "id" | "template" | "field",
    offset: number | null
  ) => {
    if (offset === null) return;
    const object = getObjectOrError();
    localStorage.setItem(
      getName(),
      JSON.stringify({
        ...object,
        [`${name}_offsets`]: [offset, ...object[`${name}_offsets`]],
      })
    );
  };

  return {
    initialize,
    getters: {
      getDocumentNumber,
      getTemplateNumber,
      getFieldNumber,
    },
  };
};

export function IdGenerator({ children }: { children: React.ReactNode }) {
  const organization = useOrganization();
  const workspace = organization!.workspaces[0].name;

  const { initialize, getters } = React.useMemo(
    () => createIdManager({ workspace, slug: organization!.slug }),
    [organization]
  );

  React.useEffect(() => {
    if (!workspace) return;
    return initialize();
  }, [workspace]);

  const ctx = React.useMemo(() => getters, [workspace]);

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
