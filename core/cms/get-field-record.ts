import {
  ValueArray,
  FieldId,
  ClientSyntaxTree,
  NestedFolder,
  RawFieldId,
  NestedDocument,
  NestedElement,
  DocumentId,
  FolderId,
  Sorting,
  NestedDocumentId,
} from "@storyflow/shared/types";
import { FolderFetch, calculate, StateGetter } from "./calculate-server";
import { DEFAULT_SYNTAX_TREE } from "./constants";
import { getRawDocumentId, getRawFieldId, isFieldOfDocument } from "./ids";
import { tokens } from "./tokens";
import type { SyntaxTreeRecord } from "./types";
import { getSyntaxTreeEntries } from "./syntax-tree";
import { getChildrenDocuments } from "./graph";

export const createFieldRecordGetter = (
  docRecord: SyntaxTreeRecord,
  context: Record<string, ValueArray>,
  fetch: (fetchObject: {
    folder: FolderId;
    filters: Record<RawFieldId, ValueArray>;
    limit: number;
    sort?: Record<RawFieldId, 1 | -1>;
  }) => Promise<{ _id: DocumentId; record: SyntaxTreeRecord }[]>,
  options: {
    createActions?: boolean;
  } = {}
) => {
  const superRecord = { ...docRecord };

  return async (fieldId: FieldId) => {
    /*
    const nestedFields = getFieldRecord(docRecord, fieldId, {
      children: graph.children,
      imports: new Map(), // do not include imports in record
    });
    */

    let record: Record<FieldId, ValueArray | ClientSyntaxTree> = {};

    let fetchRequests: FolderFetch[] = [];
    let fetched = new Set<NestedFolder>();
    let fetchFilters = new Map<NestedFolder, Record<RawFieldId, ValueArray>>();
    let fetchResults = new Map<NestedFolder, NestedDocument[]>();

    const resolveFetches = async (fetches: FolderFetch[]) => {
      await calculateFilters(fetches);

      return await Promise.all(
        fetches.map(async (el) => {
          // we rely on the fact the the NestedFolder is only really present in one field (although it is referenced multiple times)
          // so we can use its object reference
          if (fetched.has(el.folder)) return;
          fetched.add(el.folder);

          const filters = fetchFilters.get(el.folder) ?? {};

          console.log("FILTERS FILTERS FILTERS");

          const sort = el.sort
            ? (Object.fromEntries(
                el.sort.map((el) => [
                  el.slice(1) as RawFieldId,
                  el.slice(0, 1) === "+" ? 1 : -1,
                ])
              ) as Record<RawFieldId, 1 | -1>)
            : undefined;

          const articles = await fetch({
            folder: el.folder.folder,
            filters,
            limit: el.limit,
            ...(sort && { sort }),
          });

          let list: NestedDocument[] = [];

          articles.forEach((el) => {
            list.push({ id: el._id });
            Object.entries(el.record).forEach(([key, value]) => {
              if (!(key in superRecord)) {
                superRecord[key as FieldId] = value;
              }
            });
          });

          fetchResults.set(el.folder, list);
        })
      );
    };

    const getNestedValues = (
      id: NestedDocumentId
    ): Record<RawFieldId, ValueArray> => {
      return Object.fromEntries(
        Object.entries(docRecord)
          .filter(([key]) => key.startsWith(getRawDocumentId(id)))
          .map(([key, value]) => [
            getRawFieldId(key as FieldId),
            calculate(value, getState, options),
          ])
          .filter(([, value]) => Array.isArray(value) && value.length > 0)
      );
    };

    const calculateFilters = async (fetches: FolderFetch[]) => {
      const oldFetches = [...fetchRequests];

      fetches.forEach((el) => {
        const filters = getNestedValues(el.folder.id);
        fetchFilters.set(el.folder, filters);
      });

      const newFetches = fetchRequests.filter((el) => !oldFetches.includes(el));

      /*
      repeat if there are new fetches.
      */

      if (newFetches.length > 0) {
        await resolveFetches(newFetches);
        await calculateFilters(fetches);
      }
    };

    const getState: StateGetter = (importer, { tree, external }): any => {
      if (importer.type === "fetch") {
        const { folder, limit, sort } = importer.value;
        if (!fetchResults.has(folder)) {
          fetchRequests.push({ folder, limit, ...(sort && { sort }) });
          return [];
        }
        return fetchResults.get(folder);
      } else if (importer.type === "context") {
        console.log("CONTEXT LOOKUP", importer.value.ctx, context);
        return context[importer.value.ctx] ?? [];
      } else if (importer.type === "nested") {
        return [getNestedValues(importer.value)];
      } else {
        if (importer.value in superRecord) {
          return calculate(superRecord[importer.value], getState, options);
        }
        return [];
      }
    };

    const calculateAsync = async () => {
      const entry = docRecord[fieldId] ?? DEFAULT_SYNTAX_TREE;

      const oldFetches = [...fetchRequests];

      const superEntries = getSyntaxTreeEntries(superRecord);
      const relevantEntries = [] as typeof superEntries;

      relevantEntries.push([fieldId, entry]);

      const newRecord: Record<FieldId, ValueArray | ClientSyntaxTree> = {};

      const addNestedElementProps = (tree: ValueArray | ClientSyntaxTree) => {
        const children = (
          Array.isArray(tree) ? tree : getChildrenDocuments(tree)
        ).filter((el): el is NestedElement => tokens.isNestedElement(el));

        children.forEach((doc) => {
          superEntries.forEach((entry) => {
            if (
              isFieldOfDocument(entry[0], doc.id) &&
              !relevantEntries.some(([key]) => key === entry[0])
            ) {
              relevantEntries.push(entry);
            }
          });
        });
      };

      let i = 0;
      while (i < relevantEntries.length) {
        const [key, tree] = relevantEntries[i];
        const result = calculate(tree, getState, options);
        addNestedElementProps(result);
        newRecord[key] = result;
        i++;
      }

      record = newRecord;

      const newFetches = fetchRequests.filter((el) => !oldFetches.includes(el));

      if (newFetches.length > 0) {
        console.log("NEW FETCHES NEW FETCHES NEW FETCHES NEW FETCHES");
        await resolveFetches(newFetches);
        await calculateAsync();
      }
    };

    await calculateAsync();

    const entry = record[fieldId];
    delete record[fieldId];

    if (!entry || (Array.isArray(entry) && entry.length === 0)) {
      return null;
    }

    return {
      entry,
      record,
    };
  };
};
