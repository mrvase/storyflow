import {
  ValueArray,
  FieldId,
  ClientSyntaxTree,
  NestedFolder,
  RawFieldId,
  NestedDocument,
  DocumentId,
  FolderId,
  NestedDocumentId,
} from "@storyflow/shared/types";
import { FolderFetch, calculate, StateGetter } from "./calculate-server";
import { DEFAULT_SYNTAX_TREE } from "./constants";
import { getRawDocumentId, getRawFieldId, isFieldOfDocument } from "./ids";
import { tokens } from "./tokens";
import type { SyntaxTreeRecord } from "./types";
import { getSyntaxTreeEntries } from "./syntax-tree";
import { getChildrenDocuments } from "./graph";

type ValueRecord = Record<RawFieldId, ValueArray>;

export const createSharedFieldCalculator = (
  docRecord: SyntaxTreeRecord,
  context: Record<string, ValueArray>,
  fetch: (fetchObject: {
    folder: FolderId;
    filters: ValueRecord;
    limit: number;
    offset?: number;
    sort?: Record<RawFieldId, 1 | -1>;
  }) => Promise<{ _id: DocumentId; record: SyntaxTreeRecord }[]>,
  options: {
    createActions?: boolean;
    offsets?: Record<FieldId, number>;
  } = {}
) => {
  // this is a lookup table for all fields from docRecord as well as all fetched fields
  const superRecord = { ...docRecord };

  return async (fieldId: FieldId) => {
    const fetchRequests: FolderFetch[] = [];
    const fetchResults = new Map<NestedFolder, NestedDocument[]>();
    const fetchFilters = new Map<NestedFolder, ValueRecord>();

    // used to control that we do not repeat fetches of the same folder
    // when we repeat the calculation from the start
    const fetched = new Set<NestedFolder>();

    const resolveFetches = async (fetches: FolderFetch[]) => {
      await calculateFilters(fetches);

      const promises = fetches.map(async (el) => {
        // we rely on the fact the the NestedFolder is only really present in one field (although it is referenced multiple times)
        // so we can use its object reference
        if (fetched.has(el.folder)) return;
        fetched.add(el.folder);

        const filters = fetchFilters.get(el.folder) ?? {};

        const sort: Record<RawFieldId, 1 | -1> | undefined = el.sort
          ? Object.fromEntries(
              el.sort.map((el) => [
                el.slice(1) as RawFieldId,
                el.slice(0, 1) === "+" ? 1 : -1,
              ])
            )
          : undefined;

        const articles = await fetch({
          folder: el.folder.folder,
          filters,
          limit: el.limit,
          ...(sort && { sort }),
          ...(el.offset && { offset: el.offset }),
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
      });

      return await Promise.all(promises);
    };

    const getNestedValues = (id: NestedDocumentId): ValueRecord => {
      // TODO: should this not use superRecord?
      const fields = Object.entries(docRecord).filter(([key]) =>
        key.startsWith(getRawDocumentId(id))
      );

      const calculatedFields = fields
        .map(([key, value]) => {
          const offset = options?.offsets?.[key as FieldId];
          return [
            getRawFieldId(key as FieldId),
            calculate(
              value,
              getState,
              offset ? { ...options, offset } : options
            ),
          ];
        })
        .filter(([, value]) => Array.isArray(value) && value.length > 0);

      return Object.fromEntries(calculatedFields);
    };

    const calculateFilters = async (fetches: FolderFetch[]) => {
      const oldFetches = [...fetchRequests];

      fetches.forEach((el) => {
        const filters = getNestedValues(el.folder.id);
        fetchFilters.set(el.folder, filters);
      });

      // repeat if there are new fetches.
      const newFetches = fetchRequests.filter((el) => !oldFetches.includes(el));
      if (newFetches.length > 0) {
        await resolveFetches(newFetches);
        await calculateFilters(fetches);
      }
    };

    const getState: StateGetter = (importer, { tree, external }): any => {
      if (importer.type === "fetch") {
        // const { folder, limit, sort, offset } = importer.value;
        if (!fetchResults.has(importer.value.folder)) {
          fetchRequests.push(importer.value);
          return [];
        }
        return fetchResults.get(importer.value.folder);
      } else if (importer.type === "context") {
        return context[importer.value.ctx] ?? [];
      } else if (importer.type === "nested") {
        return [getNestedValues(importer.value)];
      } else if (importer.value in superRecord) {
        const offset = options?.offsets?.[importer.value];
        return calculate(
          superRecord[importer.value],
          getState,
          offset ? { ...options, offset } : options
        );
      }
      return [];
    };

    const calculateAsync = async (): Promise<
      Record<FieldId, ValueArray | ClientSyntaxTree>
    > => {
      const oldFetches = [...fetchRequests];

      const entry = docRecord[fieldId] ?? DEFAULT_SYNTAX_TREE;

      const relevantEntries = [[fieldId, entry]] as typeof superEntries;
      const superEntries = getSyntaxTreeEntries(superRecord);

      const addNestedElementProps = (tree: ValueArray | ClientSyntaxTree) => {
        const childrenElements = (
          Array.isArray(tree) ? tree : getChildrenDocuments(tree)
        ).filter(tokens.isNestedElement);

        superEntries.forEach((entry) => {
          const isRelevant = childrenElements.some(({ id }) =>
            isFieldOfDocument(entry[0], id)
          );

          if (!isRelevant || relevantEntries.includes(entry)) {
            return;
          }

          relevantEntries.push(entry);
        });
      };

      const record: Record<FieldId, ValueArray | ClientSyntaxTree> = {};

      // We start by calculating the entry field (the only initial element of relevantEntries).
      // We then find all nested fields that are properties of nested elements.
      // We then repeat the process for those fields until there are no additional nested fields.
      let i = 0;
      while (i < relevantEntries.length) {
        const [key, tree] = relevantEntries[i];
        const offset = options?.offsets?.[key];
        const result = calculate(
          tree,
          getState,
          offset ? { ...options, offset } : options
        );
        record[key] = result;
        addNestedElementProps(result);
        i++;
      }

      const newFetches = fetchRequests.filter((el) => !oldFetches.includes(el));

      if (newFetches.length === 0) return record;

      await resolveFetches(newFetches);
      return await calculateAsync();
    };

    const record = await calculateAsync();

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

export const getFieldValues = () => {};
