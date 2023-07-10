import type {
  DocumentId,
  FieldId,
  FolderId,
  NestedDocumentId,
  RawFieldId,
  ValueArray,
} from "@storyflow/shared/types";
import type {
  DBDocument,
  DocumentConfig,
  DocumentVersionRecord,
} from "@storyflow/cms/types";
import type { DBDocumentRaw, DBId, DBValueRecord } from "../types";
import type {
  SyntaxTreeRecord,
  SyntaxTree,
  NestedField,
} from "@storyflow/cms/types";
import { parseDocument, unwrapObjectId } from "../convert";
import { client } from "../mongo";
import { isSyntaxTree } from "@storyflow/cms/syntax-tree";
import {
  extractRootRecord,
  getFieldRecord,
  getGraph,
  getPickedDocumentIds,
} from "@storyflow/cms/graph";
import { createStages, Update } from "../fields/stages";
import util from "util";
import {
  computeFieldId,
  getDocumentId,
  getRawFieldId,
  isFieldOfDocument,
  isNestedDocumentId,
  isTemplateField,
} from "@storyflow/cms/ids";
import { deduplicate, getImports, getSortedValues } from "./helpers";
import { createSyntaxStream } from "../parse-syntax-stream";
import { createObjectId } from "../mongo";
import { RPCError } from "@nanorpc/server";

const getDocumentIds = (fieldIds: FieldId[]) => {
  const array = fieldIds
    .map((el) => getDocumentId(el))
    .filter(
      (el): el is Exclude<typeof el, NestedDocumentId> =>
        !isNestedDocumentId(el)
    );
  return new Set(array);
};

/*
IMPORTANT ASSUMPTION 1
We do NOT know the values of the document's imports (even though they are stored in the document).
We need to fetch them first.
The catch: we cannot fetch all imports in the first pass, since some import
ids are computed from other imports (with "pick" function).
*/

// we need to consider drefs for two purposes:
// a) an updated field might resolve to a dref in which case an external import of the field
//    could run a "pick" on it, and we need the drefs to create derivatives.
// b) the updated field runs a "pick" on an import itself, and we need to fetch
//    the picked field. Things to take into account:
//    a) If it picks from an internal field, the ids have been found through flatten().
//    b) If it picks from an external field, we cannot obtain the dref before we have fetched the external field.

// Before fetching imports, we can handle:
// 1) the updated fields that resolve to drefs should be used to produce derivatives

// After fetching imports, we can handle:
// 1') the updated fields that resolve to drefs should be used to produce derivatives
// 2) the updated fields that picks from an external field should be used to produce field import ids.

/*
TODO: Among the imports of imports, there may be fields from the saved article.
These are not added since flatten() makes sure it does not add fields that are
already added. But if it is a deleted field that is not included in the original
computationRecord, it gets added to the flattenedRecord through the imports.
This is perhaps the way it should work to ensure consistency. When the imported
field is computed with the cached value of the deleted field, it should not obtain
a different value now that it is imported back into the article.
*/

const getFirstImportSet = ({
  record,
  updatedFieldIds,
  documentId,
}: {
  record: SyntaxTreeRecord;
  updatedFieldIds: Set<FieldId>;
  documentId: DocumentId;
}) => {
  let graph = getGraph(record);

  const externalFieldIds = deduplicate(
    Array.from(graph.imports.values()).flat(1)
  ).filter((id) => !isFieldOfDocument(id, documentId)) as FieldId[];

  const externalDocumentIds = getDocumentIds(externalFieldIds);

  const drefs: DocumentId[] = [];

  updatedFieldIds.forEach((fieldId) => {
    // even though we are not concerned with picked document ids,
    // we can use the same function to get drefs
    drefs.push(...getPickedDocumentIds(fieldId, record));
  });

  drefs.forEach((ref) => externalDocumentIds.add(ref));

  return {
    externalFieldIds,
    externalDocumentIds,
    drefs,
  };
};

const getSecondImportSet = ({
  record,
  updatedFieldIds,
  prev,
}: {
  record: SyntaxTreeRecord;
  updatedFieldIds: Set<FieldId>;
  prev: {
    externalFieldIds: FieldId[];
    externalDocumentIds: Set<DocumentId>;
    drefs: DocumentId[];
  };
}) => {
  let graph = getGraph(record);

  const newDrefs: DocumentId[] = [];
  const newExternalFieldIds: FieldId[] = [];

  updatedFieldIds.forEach((fieldId) => {
    // 1')
    getPickedDocumentIds(fieldId, record).forEach((id) => {
      if (!prev.drefs.includes(id)) {
        newDrefs.push(id);
      }
    });
    // 2)
    const check = [fieldId, ...(graph.children.get(fieldId) ?? [])];
    check.forEach((id) => {
      const tree = record[id];
      if (!tree) return;
      const traverseNode = (node: SyntaxTree) => {
        if (node.type === "select") {
          const nestedField = node.children[0] as NestedField;
          const drefs = getPickedDocumentIds(nestedField.field, record);
          drefs.forEach((dref) => {
            const newFieldId = computeFieldId(dref, node.data!);
            if (!prev.externalFieldIds.includes(newFieldId)) {
              newExternalFieldIds.push(newFieldId);
            }
          });
        }

        node.children.forEach((token) => {
          if (isSyntaxTree(token)) {
            traverseNode(token);
          }
        });
      };

      traverseNode(tree);
    });
  });

  const newExternalDocumentIds = [
    ...Array.from(getDocumentIds(newExternalFieldIds)),
    ...newDrefs,
  ].filter((el) => !prev.externalDocumentIds.has(el));

  return {
    externalFieldIds: newExternalFieldIds,
    externalDocumentIds: new Set(newExternalDocumentIds),
    drefs: newDrefs,
  };
};

export const updateRecord = async ({
  oldRecord: record,
  newRecord,
  documentId,
}: {
  oldRecord: SyntaxTreeRecord;
  newRecord: SyntaxTreeRecord;
  documentId: DocumentId;
}) => {
  const updatedFieldIds = new Set(Object.keys(newRecord) as FieldId[]);

  // is this needed?
  record = extractRootRecord(documentId, record, {
    excludeImports: true,
  });

  // UPDATE RECORD
  Object.assign(record, newRecord);

  // trim to not include removed nested fields
  record = extractRootRecord(documentId, record, {
    excludeImports: true,
  });

  // TODO delete native fields from computationRecord that are not in documentConfig.
  // AND delete template fields whose template is not in documentConfig.
  // BUT! template fields can be nested and therefore hidden!!
  // - possible solution: Include ids of nested template fields in request.
  // I should also delete them from the "versions" and "updated" objects.

  const db = await client.get();

  const importedDocuments: (DBDocument & { values: DBValueRecord })[] = [];
  const getImportedDocuments = (externalDocumentIds: Set<DocumentId>) => {
    return db
      .collection<DBDocumentRaw>("documents")
      .find({
        _id: {
          $in: Array.from(externalDocumentIds).map(createObjectId),
        },
      })
      .forEach((el) => {
        importedDocuments.push(
          Object.assign(parseDocument(el), { values: el.values })
        );
      });
  };

  const first = getFirstImportSet({ documentId, record, updatedFieldIds });

  // fetch imported documents
  if (first.externalDocumentIds.size > 0) {
    await getImportedDocuments(first.externalDocumentIds);
  }
  if (first.externalFieldIds.length > 0) {
    record = {
      ...getImports(first.externalFieldIds, importedDocuments),
      ...record,
    };
  }

  const second = getSecondImportSet({ record, prev: first, updatedFieldIds });

  if (second.externalDocumentIds.size > 0) {
    await getImportedDocuments(second.externalDocumentIds);
  }
  if (second.externalFieldIds.length > 0) {
    record = {
      ...getImports(second.externalFieldIds, importedDocuments),
      ...record,
    };
  }

  const drefDocuments = importedDocuments.filter(
    (doc) => first.drefs.includes(doc._id) || second.drefs.includes(doc._id)
  );

  const derivatives: Update[] = [];

  drefDocuments.forEach((doc) => {
    (Object.keys(doc.record) as FieldId[])
      .filter((el) => isFieldOfDocument(el, doc._id))
      .forEach((id) => {
        if (!isTemplateField(id)) return;
        const value = createSyntaxStream(doc.record[id], (id) =>
          createObjectId(id)
        );
        const _imports = getFieldBlocksWithDepths(id, doc.record).filter(
          (el) => el.k.toHexString() !== id
        );
        derivatives.push({
          k: createObjectId(id),
          v: value,
          depth: 0,
          result: doc.values[getRawFieldId(id)],
          // it does exist in values because template field values are always saved to values
          _imports,
          updated: true,
        });
      });
  });

  return { record, derivatives };
};

async function propagateResult({
  doc,
  derivatives,
  input,
}: {
  doc: DBDocumentRaw;
  derivatives: Update[];
  input: {
    versions: Partial<DocumentVersionRecord>;
  };
}) {
  const db = await client.get();

  const updatedRawFieldIdsAtRoot = Object.keys(input.versions).filter(
    (el) => el !== "config"
  ) as RawFieldId[];

  // includes imports by default
  const documentId = unwrapObjectId(doc._id);

  const record = parseDocument(doc).record;
  const cachedRecord: Record<FieldId, ValueArray> = Object.fromEntries(
    doc.cached.map(({ k, v }) => [unwrapObjectId(k), v])
  );

  console.log(
    util.inspect({ savedRecord: record }, { depth: null, colors: true })
  );

  // create updates

  const updates: Update[] = Array.from(updatedRawFieldIdsAtRoot, (rawId) => {
    const id = computeFieldId(documentId, rawId);
    console.log("UPDATING", id);
    const value = createSyntaxStream(record[id], (id) => createObjectId(id));
    const objectId = createObjectId(id);
    const _imports = getFieldBlocksWithDepths(id, record).filter(
      (el) => el.k.toHexString() !== id
    );
    return {
      k: objectId,
      v: value,
      depth: 0,
      result: doc.values[rawId] ?? cachedRecord[id] ?? [],
      _imports,
      // imports: [], // should just be empty
      // nested: [],
      updated: true,
    };
  });

  console.log(util.inspect({ updates }, { depth: null, colors: true }));

  /*
  I could first find the articles and in the update stage use the article ids
  then I could send urls back to the client for revalidation.
  */

  const stages = createStages(updates, derivatives);

  await db.collection<DBDocumentRaw>("documents").updateMany(
    {
      "fields.k": { $in: updates.map((el) => el.k) },
      _id: { $ne: createObjectId(documentId) },
    },
    stages,
    {
      writeConcern: { w: "majority" },
    }
  );
}

export async function saveDocument({
  input,
  versions,
  record,
  derivatives,
  documentId,
  isCreatedFromValues,
}: {
  input: {
    folder: string;
    versions: Partial<DocumentVersionRecord>;
    config: DocumentConfig;
  };
  versions: DocumentVersionRecord;
  record: SyntaxTreeRecord;
  derivatives: Update[];
  documentId: DocumentId;
  isCreatedFromValues?: boolean;
}) {
  const db = await client.get();

  const { fields, values } = getSortedValues(record, getGraph(record), {
    returnValuesForDocument: documentId,
  });

  console.log(
    util.inspect(
      { record, fields, values, derivatives },
      { depth: null, colors: true }
    )
  );

  const cached: DBId<FieldId>[] = [];
  const timestamp = Date.now();
  const updated: Record<string, number> = {};

  if (isCreatedFromValues) {
    Object.entries(values).forEach(([rawId, value]) => {
      updated[`updated.${rawId}`] = timestamp;
    });
  } else {
    const updatedRawFieldIdsAtRoot = Object.keys(input.versions).filter(
      (el) => el !== "config"
    ) as RawFieldId[];

    updatedRawFieldIdsAtRoot.forEach((rawId) => {
      updated[`updated.${rawId}`] = timestamp;
      const id = computeFieldId(documentId, rawId);
      if (!(id in values) && !isTemplateField(id)) {
        cached.push(createObjectId(id));
      }
    });
  }

  const stages: any = [
    {
      $set: {
        ...(input.folder && { folder: createObjectId(input.folder) }),
        values: { $literal: values }, // uses $literal to do hard replace (otherwise: merges old with new values)
        fields: { $literal: fields },
        config: { $literal: input.config },
        versions: { $literal: versions },
        cached: cached as any,
        ...updated,
      },
    },
  ];

  if (fields.length > 0) {
    stages.push(
      ...createStages([], derivatives, { cache: Boolean(cached.length) })
    );
  }

  const result = await db
    .collection<DBDocumentRaw>("documents")
    .findOneAndUpdate({ _id: createObjectId(documentId) }, stages, {
      upsert: true,
      returnDocument: "after",
      writeConcern: { w: "majority" },
    });

  const doc = result.value;

  if (!doc) {
    throw new RPCError({
      code: "SERVER_ERROR",
      message: "Save failed.",
    });
  }

  if (!isCreatedFromValues) {
    await propagateResult({ doc, derivatives, input });
  }

  return parseDocument(doc);
}

export async function createDocument({
  folderId,
  values,
  documentId,
}: {
  values: DBValueRecord;
  documentId: DocumentId;
  folderId: FolderId;
}) {
  const db = await client.get();

  const timestamp = Date.now();

  const updated = Object.fromEntries(
    Object.keys(values).map((key) => [key, timestamp])
  );

  const doc: DBDocumentRaw = {
    _id: createObjectId(documentId),
    folder: createObjectId(folderId),
    values,
    fields: [],
    config: [],
    versions: { config: [0] },
    updated,
    cached: [],
  };

  const result = await db.collection<DBDocumentRaw>("documents").insertOne(doc);

  if (!result.acknowledged) {
    return new RPCError({
      code: "SERVER_ERROR",
      status: 500,
      message: "Could not save document",
    });
  }
}

const getFieldBlocksWithDepths = (
  fieldId: FieldId,
  record: SyntaxTreeRecord
) => {
  const graph = getGraph(record);
  const fieldRecord = getFieldRecord(record, fieldId, graph);
  const { fields } = getSortedValues(fieldRecord, graph, { keepDepths: true });
  return fields;
};
