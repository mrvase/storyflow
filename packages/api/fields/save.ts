import type {
  DocumentId,
  FieldId,
  RawFieldId,
  ValueArray,
} from "@storyflow/shared/types";
import type {
  DocumentConfig,
  DocumentVersionRecord,
} from "@storyflow/cms/types";
import type { DBDocumentRaw, DBId } from "../types";
import type {
  SyntaxTreeRecord,
  SyntaxTree,
  NestedField,
} from "@storyflow/cms/types";
import { getSyntaxTreeRecord, parseDocument } from "../convert";
import { getClientPromise } from "../mongoClient";
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

export async function save(
  input: {
    id: string;
    folder: string;
    config: any[];
    record: Record<string, any>;
    versions: Record<string, any>;
  },
  dbName?: string
) {
  const documentId = input.id as DocumentId;

  const db = (await getClientPromise()).db(dbName);

  let doc = (await db
    .collection<DBDocumentRaw>("documents")
    .findOne({ _id: createObjectId(documentId) })) ?? {
    _id: createObjectId(documentId),
    folder: undefined,
    fields: [],
    values: {},
    versions: { config: [0] },
  };

  let config = input.config as DocumentConfig;
  const versions = doc.versions as DocumentVersionRecord;

  /*
  IMPORTANT ASSUMPTION 1
  We do NOT know the values of the document's imports (even though they are stored in the document).
  We need to fetch them first.
  The catch: we cannot fetch all imports in the first pass, since some import
  ids are computed from other imports (with "pick" function).
  */

  const updatedFieldIds = new Set(Object.keys(input.record) as FieldId[]);

  const updatedRawFieldIdsAtRoot = Object.keys(input.versions).filter(
    (el) => el !== "config"
  ) as RawFieldId[];

  let record = extractRootRecord(
    documentId,
    getSyntaxTreeRecord(documentId, doc),
    {
      excludeImports: true,
    }
  );

  Object.assign(record, input.record);
  Object.assign(versions, input.versions);

  // trim to not include removed nested fields
  record = extractRootRecord(documentId, record, {
    excludeImports: true,
  });

  console.log(
    "updated record",
    util.inspect(record, { depth: null, colors: true })
  );

  // TODO delete native fields from computationRecord that are not in documentConfig.
  // AND delete template fields whose template is not in documentConfig.
  // BUT! template fields can be nested and therefore hidden!!
  // - possible solution: Include ids of nested template fields in request.
  // I should also delete them from the "versions" and "updated" objects.

  let graph = getGraph(record);

  console.log("GRAPH", util.inspect(graph, { depth: null, colors: true }));

  const externalFieldIds = deduplicate(
    Array.from(graph.imports.values()).flat(1)
  ).filter((id) => !isFieldOfDocument(id, documentId)) as FieldId[];

  const getDocumentIds = (fieldIds: FieldId[]) => {
    return fieldIds.reduce((acc: DocumentId[], cur) => {
      const docId = getDocumentId(cur);
      if (!isNestedDocumentId(docId) && !acc.includes(docId)) acc.push(docId);
      return acc;
    }, []);
  };

  const externalDocumentIds = getDocumentIds(externalFieldIds);

  const drefs: DocumentId[] = [];

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

  updatedFieldIds.forEach((fieldId) => {
    // even though we are not concerned with picked document ids,
    // we can use the same function to get drefs
    drefs.push(...getPickedDocumentIds(fieldId, record));
  });

  drefs.forEach((ref) => {
    if (!externalDocumentIds.includes(ref)) {
      externalDocumentIds.push(ref);
    }
  });

  console.log("EXTERNAL", externalDocumentIds);

  const importedArticlesRaw = await db
    .collection<DBDocumentRaw>("documents")
    .find({
      _id: {
        $in: externalDocumentIds.map((el) => createObjectId(el)),
      },
    })
    .toArray();

  const importedArticles = importedArticlesRaw.map((el) =>
    Object.assign(parseDocument(el), { values: el.values })
  );

  let importsRecord = getImports(externalFieldIds, importedArticles);

  console.log(
    "imports",
    util.inspect(importsRecord, { depth: null, colors: true })
  );

  // second import check

  /*
  TODO: Among the imports of imports, there may be fields from the saved article.
  These are not added since flatten() makes sure it does not add fields that are
  already added. But if it is a deleted field that is not included in the original
  computationRecord, it gets added to the flattenedRecord through the imports.
  This is perhaps the way it should work to ensure consistency. When the imported
  field is computed with the cached value of the deleted field, it should not obtain
  a different value now that it is imported back into the article.
*/

  let fullRecord = { ...importsRecord, ...record };

  console.log(
    "full record",
    util.inspect(fullRecord, { depth: null, colors: true })
  );

  graph = getGraph(fullRecord);

  console.log("graph 2", util.inspect(graph, { depth: null, colors: true }));

  const newDrefs: DocumentId[] = [];
  const newExternalFieldIds: FieldId[] = [];

  updatedFieldIds.forEach((fieldId) => {
    // 1')
    getPickedDocumentIds(fieldId, fullRecord).forEach((id) => {
      if (!drefs.includes(id)) {
        newDrefs.push(id);
      }
    });
    // 2)
    const check = [fieldId, ...(graph.children.get(fieldId) ?? [])];
    check.forEach((id) => {
      const tree = fullRecord[id];
      if (!tree) return;
      const traverseNode = (node: SyntaxTree) => {
        if (node.type === "select") {
          const nestedField = node.children[0] as NestedField;
          const drefs = getPickedDocumentIds(nestedField.field, fullRecord);
          drefs.forEach((dref) => {
            const newFieldId = computeFieldId(dref, node.data!);
            if (!externalFieldIds.includes(newFieldId)) {
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
    ...getDocumentIds(newExternalFieldIds),
    ...newDrefs,
  ].filter((el) => !externalDocumentIds.includes(el));

  if (newExternalDocumentIds.length) {
    await db
      .collection<DBDocumentRaw>("documents")
      .find({
        id: {
          $in: newExternalDocumentIds,
        },
      })
      .forEach((doc) => {
        importedArticles.push(
          Object.assign(parseDocument(doc), { values: doc.values })
        );
      });
  }

  if (newExternalFieldIds.length) {
    let extraImportsRecord = getImports(newExternalFieldIds, importedArticles);
    fullRecord = { ...fullRecord, ...extraImportsRecord };
    graph = getGraph(fullRecord);
    console.log(
      "EXTRA EXTRA",
      util.inspect({ fullRecord, graph }, { depth: null, colors: true })
    );
  }

  const drefArticles = importedArticles.filter(
    (doc) => drefs.includes(doc._id) || newDrefs.includes(doc._id)
  );

  const { fields, values } = getSortedValues(fullRecord, graph, {
    returnValuesForDocument: documentId,
  });

  console.log(
    "RESULT",
    util.inspect(
      { fullRecord, graph, fields, values },
      { depth: null, colors: true }
    )
  );

  const derivatives: Update[] = [];

  drefArticles.forEach((doc) => {
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
          // imports: [], // should just be empty
          // nested: [],
          updated: true,
        });
      });
  });

  console.log(
    "DERIVATIVES",
    util.inspect(
      derivatives.map((el) => ({
        ...el,
      })),
      { depth: null, colors: true }
    )
  );

  const cached: DBId<FieldId>[] = [];
  const timestamp = Date.now();
  const updated: Record<string, number> = {};

  updatedRawFieldIdsAtRoot.forEach((rawId) => {
    updated[`updated.${rawId}`] = timestamp;
    const id = computeFieldId(documentId, rawId);
    if (!(id in values) && !isTemplateField(id)) {
      cached.push(createObjectId(id));
    }
  });

  const stages: any = [
    {
      $set: {
        folder: doc.folder || createObjectId(input.folder),
        values: { $literal: values }, // uses $literal to do hard replace (otherwise: merges old with new values)
        fields: { $literal: fields },
        config: { $literal: config },
        versions: { $literal: versions },
        cached: cached as any,
        ...updated,
      },
    },
    ...createStages([], derivatives, { cache: Boolean(cached.length) }),
  ];

  const result1 = await db
    .collection<DBDocumentRaw>("documents")
    .findOneAndUpdate({ _id: createObjectId(documentId) }, stages, {
      upsert: true,
      returnDocument: "after",
      writeConcern: { w: "majority" },
    });

  if (result1.ok) {
    const doc = result1.value!;
    // includes imports by default
    const record = parseDocument(doc).record;
    const cachedValues = doc!.cached;
    const cachedRecord: Record<FieldId, ValueArray> = Object.fromEntries(
      cached.map((id, index) => [id, cachedValues[index]])
    );

    // create updates

    const updates: Update[] = Array.from(updatedRawFieldIdsAtRoot, (rawId) => {
      const id = computeFieldId(documentId, rawId);
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

    console.log(
      "UPDATES",
      util.inspect(updates, { depth: null, colors: true })
    );

    /*
        I could first find the articles and in the update stage use the article ids
        then I could send urls back to the client for revalidation.
        */

    const stages = createStages(updates, derivatives);

    console.log(util.inspect(stages[0], { depth: null, colors: true }));

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

    return parseDocument(result1.value!);
  }

  return new RPCError({
    code: "SERVER_ERROR",
    message: "Save failed.",
  });
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
