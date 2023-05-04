import { createProcedure, createRoute } from "@sfrpc/server";
import { error, success } from "@storyflow/result";
import { z } from "zod";
import type { DocumentId, FieldId, ValueArray } from "@storyflow/shared/types";
import type {
  DBDocumentRaw,
  DBId,
  DocumentConfig,
  DocumentVersionRecord,
} from "@storyflow/db-core/types";
import type {
  SyntaxTreeRecord,
  SyntaxTree,
  NestedField,
} from "@storyflow/fields-core/types";
import { getSyntaxTreeRecord, parseDocument } from "@storyflow/db-core/convert";
import { clientPromise } from "../mongoClient";
import { globals } from "../globals";
import { isSyntaxTree } from "@storyflow/fields-core/syntax-tree";
import {
  extractRootRecord,
  getFieldRecord,
  getGraph,
  getPickedDocumentIds,
} from "@storyflow/fields-core/graph";
import { createStages, Update } from "../aggregation/stages";
import util from "util";
import {
  computeFieldId,
  getDocumentId,
  getRawFieldId,
  isFieldOfDocument,
  isNestedDocumentId,
  isTemplateField,
} from "@storyflow/fields-core/ids";
import { deduplicate, getImports, getSortedValues } from "./helpers";
import { createSyntaxStream } from "@storyflow/db-core/parse-syntax-stream";
import { createObjectId } from "../../../packages/api-core/mongo";

export const fields = createRoute({
  /*
  sync: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.record(
        z.string(), // document
        z.record(
          z.string(), // key
          ZodServerPackage(
            ZodDocumentOp(
              z.union([
                ZodToggle(z.any()),
                ZodSplice(z.any()),
                z.object({
                  add: z.object({
                    _id: z.string(),
                    type: z.string(),
                    label: z.string(),
                    spaces: z.array(z.any()),
                  }),
                }),
                z.object({ remove: z.string() }),
              ])
            )
          )
        )
      );
    },
    async mutation(input, { slug }) {
      try {
        let pipeline: ReturnType<typeof client.pipeline> | null = null;

        Object.entries(input).map(([key, record]) => {
          let array = Object.values(record);
          if (array.length) {
            if (!pipeline) {
              pipeline = client.pipeline();
            }
            pipeline.rpush(
              `${slug}:${key}`,
              ...array.map((el) => JSON.stringify(el))
            );
          }
        });

        if (pipeline) {
          await (pipeline as any).exec();
        }

        let histories: Awaited<ReturnType<typeof getHistoriesFromIds>> = {};

        let keys = Object.keys(input);

        if (keys.length) {
          histories = await getHistoriesFromIds(
            slug,
            Object.keys(input) as RawDocumentId[]
          );
        }

        const result = modifyValues(histories, (array) => sortHistories(array));

        return success(result);
      } catch (err) {
        console.log(err);
        return error({ message: "Lykkedes ikke", detail: err });
      }
    },
  }),
  */

  save: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({
        id: z.string(),
        folder: z.string(),
        config: z.array(z.any()),
        record: z.record(z.string(), z.any()),
        versions: z.record(z.string(), z.any()),
      });
    },
    async mutation(input, { dbName, slug }) {
      const documentId = input.id as DocumentId;

      const db = (await clientPromise).db(dbName);

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

      const updatedFieldsIds = new Set(Object.keys(input.record) as FieldId[]);

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
          if (!isNestedDocumentId(docId) && !acc.includes(docId))
            acc.push(docId);
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

      updatedFieldsIds.forEach((fieldId) => {
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

      console.log(
        "graph 2",
        util.inspect(graph, { depth: null, colors: true })
      );

      const newDrefs: DocumentId[] = [];
      const newExternalFieldIds: FieldId[] = [];

      updatedFieldsIds.forEach((fieldId) => {
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
        let extraImportsRecord = getImports(
          newExternalFieldIds,
          importedArticles
        );
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
      updatedFieldsIds.forEach((id) => {
        updated[`updated.${getRawFieldId(id)}`] = timestamp;
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

        const updates: Update[] = Array.from(updatedFieldsIds, (id) => {
          const value = createSyntaxStream(record[id], (id) =>
            createObjectId(id)
          );
          const objectId = createObjectId(id);
          const _imports = getFieldBlocksWithDepths(id, record).filter(
            (el) => el.k.toHexString() !== id
          );
          return {
            k: objectId,
            v: value,
            depth: 0,
            result: doc.values[getRawFieldId(id)] ?? cachedRecord[id] ?? [],
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

        return success(parseDocument(result1.value!));
      }

      return error({ message: "did not succeed" });
    },
  }),
});

const getFieldBlocksWithDepths = (
  fieldId: FieldId,
  record: SyntaxTreeRecord
) => {
  const graph = getGraph(record);
  const fieldRecord = getFieldRecord(record, fieldId, graph);
  const { fields } = getSortedValues(fieldRecord, graph, { keepDepths: true });
  return fields;
};
