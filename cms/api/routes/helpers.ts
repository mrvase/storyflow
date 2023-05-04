import type { DocumentId, FieldId } from "@storyflow/shared/types";
import type { SyntaxTreeRecord } from "@storyflow/fields-core/types";
import type {
  DBDocument,
  DBValueRecord,
  DBSyntaxStreamBlock,
  DBSyntaxStream,
} from "@storyflow/db-core/types";
import {
  FieldGraph,
  getFieldRecord,
  getGraph,
} from "@storyflow/fields-core/graph";
import { getSyntaxTreeEntries } from "@storyflow/fields-core/syntax-tree";
import { getDocumentId, getRawFieldId } from "@storyflow/fields-core/ids";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/fields-core/constants";
import { createSyntaxStream } from "@storyflow/db-core/parse-syntax-stream";
import { tokens } from "@storyflow/fields-core/tokens";
import { createObjectId } from "../../../packages/api-core/mongo";

export const deduplicate = <T>(arr: T[]): T[] => Array.from(new Set(arr));

export const getImports = (
  importIds: FieldId[],
  importedArticles: DBDocument[]
): SyntaxTreeRecord => {
  const importRecord: SyntaxTreeRecord = {};

  importIds.forEach((id) => {
    const article = importedArticles.find((el) => el._id === getDocumentId(id));
    if (article) {
      const record = article.record;
      const value = record[id];
      if (value) {
        Object.assign(
          importRecord,
          getFieldRecord(record, id, getGraph(record))
        );
        return;
      }
    }
    importRecord[id] = DEFAULT_SYNTAX_TREE;
  });

  return importRecord;
};

export function getSortedValues(
  record: SyntaxTreeRecord,
  graph: FieldGraph
): { fields: DBSyntaxStreamBlock[] };
export function getSortedValues(
  record: SyntaxTreeRecord,
  graph: FieldGraph,
  options: {
    keepDepths: true;
  }
): { fields: (DBSyntaxStreamBlock & { depth: number })[] };
export function getSortedValues(
  record: SyntaxTreeRecord,
  graph: FieldGraph,
  options: {
    returnValuesForDocument: DocumentId;
  }
): { values: DBValueRecord; fields: DBSyntaxStreamBlock[] };
export function getSortedValues(
  record: SyntaxTreeRecord,
  graph: FieldGraph,
  options: {
    returnValuesForDocument?: DocumentId;
    keepDepths?: boolean;
  } = {}
): {
  values?: DBValueRecord;
  fields: (DBSyntaxStreamBlock & { depth?: number })[];
} {
  let computeWithDepth: (DBSyntaxStreamBlock & { depth: number })[] = [];
  let values: DBValueRecord = {};

  const isPrimitive = (
    computation: DBSyntaxStream
  ): computation is (string | boolean | number | Date)[] => {
    return computation.every((el) => tokens.isPrimitiveValue(el));
  };

  const depthCache = new Map<FieldId, number>();

  const getDepth = (id: FieldId): number => {
    // 0 is result if field.imports === 0
    const cached = depthCache.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const importers: FieldId[] = [];

    graph.imports.forEach((value, key) => {
      if (value.includes(id)) {
        importers.push(key);
      }
    });

    graph.children.forEach((value, key) => {
      if (value.includes(id)) {
        importers.push(key);
      }
    });

    const result = Math.max(-1, ...importers.map(getDepth)) + 1;
    depthCache.set(id, result);
    return result;
  };

  getSyntaxTreeEntries(record).map(([fieldId, value]) => {
    const stream = createSyntaxStream(value, (id) => createObjectId(id));
    if (
      isPrimitive(stream) &&
      getDocumentId(fieldId) === options.returnValuesForDocument
    ) {
      values[getRawFieldId(fieldId)] = stream;
    } else {
      computeWithDepth.push({
        k: createObjectId(fieldId),
        v: stream,
        depth: getDepth(fieldId),
      });
    }
  });

  // SORT BY AND REMOVE DEPTH
  computeWithDepth.sort((a, b) => b.depth - a.depth);

  if (options.keepDepths) {
    if (options.returnValuesForDocument) {
      return { values, fields: computeWithDepth };
    }
    return { fields: computeWithDepth };
  }

  const fields = computeWithDepth.map(({ depth, ...el }) => el);

  if (options.returnValuesForDocument) {
    return { values, fields };
  }

  return { fields };
}
