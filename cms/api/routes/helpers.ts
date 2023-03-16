import {
  DBDocument,
  DocumentId,
  ComputationBlock,
  Computation,
  FieldId,
  ComputationRecord,
  DBValueRecord,
  DBComputation,
  DBValue,
  Value,
} from "@storyflow/backend/types";
import { ObjectId } from "mongodb";
import {
  ComputationGraph,
  getComputationEntries,
  getFieldRecord,
  getGraph,
} from "shared/computation-tools";
import { getDocumentId, getRawFieldId } from "@storyflow/backend/ids";

export const deduplicate = <T>(arr: T[]): T[] => Array.from(new Set(arr));

export const getImports = (
  importIds: FieldId[],
  importedArticles: DBDocument[]
): ComputationRecord => {
  const importRecord: ComputationRecord = {};

  importIds.forEach((id) => {
    const article = importedArticles.find((el) => el._id === getDocumentId(id));
    if (article) {
      const record = article.record;
      const value = record[id];
      console.log("IMPORTED VALUE", id, value);
      if (value) {
        Object.assign(
          importRecord,
          getFieldRecord(record, id, getGraph(record))
        );
        return;
      }
    }
    importRecord[id] = [];
  });

  return importRecord;
};

export function addNestedObjectIds(value: Value[]): DBValue[];
export function addNestedObjectIds(value: Computation): DBComputation;
export function addNestedObjectIds(
  value: Computation | Value[]
): DBComputation | DBValue[] {
  return value.map((el) => {
    if (el === null || typeof el !== "object") return el;
    if (Array.isArray(el)) {
      return addNestedObjectIds(el);
    }
    if (!("id" in el)) return el;
    return {
      ...el,
      id: new ObjectId(el.id),
      ...("field" in el && { field: new ObjectId(el.field) }),
      ...("folder" in el && { folder: new ObjectId(el.folder) }),
    };
  });
}

export function getSortedValues(
  record: ComputationRecord,
  graph: ComputationGraph
): { compute: ComputationBlock[] };
export function getSortedValues(
  record: ComputationRecord,
  graph: ComputationGraph,
  options: {
    keepDepths: true;
  }
): { compute: (ComputationBlock & { depth: number })[] };
export function getSortedValues(
  record: ComputationRecord,
  graph: ComputationGraph,
  options: {
    returnValuesForDocument: DocumentId;
  }
): { values: DBValueRecord; compute: ComputationBlock[] };
export function getSortedValues(
  record: ComputationRecord,
  graph: ComputationGraph,
  options: {
    returnValuesForDocument?: DocumentId;
    keepDepths?: boolean;
  } = {}
): {
  values?: DBValueRecord;
  compute: (ComputationBlock & { depth?: number })[];
} {
  let computeWithDepth: (ComputationBlock & { depth: number })[] = [];
  let values: DBValueRecord = {};

  const isPrimitive = (
    computation: Computation
  ): computation is (string | boolean | number | Date)[] => {
    return computation.every(
      (el) =>
        ["string", "boolean", "number"].includes(typeof el) ||
        el instanceof Date
    );
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

  getComputationEntries(record).map(([fieldId, value]) => {
    if (
      isPrimitive(value) &&
      getDocumentId(fieldId) === options.returnValuesForDocument
    ) {
      values[getRawFieldId(fieldId)] = value;
    } else {
      computeWithDepth.push({
        id: new ObjectId(fieldId),
        value: addNestedObjectIds(value),
        depth: getDepth(fieldId),
      });
    }
  });

  // SORT BY AND REMOVE DEPTH
  computeWithDepth.sort((a, b) => b.depth - a.depth);

  if (options.keepDepths) {
    if (options.returnValuesForDocument) {
      return { values, compute: computeWithDepth };
    }
    return { compute: computeWithDepth };
  }

  const compute = computeWithDepth.map(({ depth, ...el }) => el);

  if (options.returnValuesForDocument) {
    return { values, compute };
  }

  return { compute };
}
