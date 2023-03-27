import { createProcedure, createRoute } from "@sfrpc/server";
import { error, success } from "@storyflow/result";
import { z } from "zod";
import {
  DBDocument,
  DocumentId,
  FieldId,
  DBDocumentRaw,
  RawDocumentId,
  RawFieldId,
  DBId,
  SyntaxTreeRecord,
  TokenStream,
  Transform,
  SyntaxTree,
  NestedField,
  ValueArray,
  DocumentConfig,
  TemplateRef,
} from "@storyflow/backend/types";
import { ObjectId } from "mongodb";
import clientPromise from "../mongo/mongoClient";
import { globals } from "../middleware/globals";
import {
  filterServerPackages,
  ServerPackage,
  unwrapServerPackage,
} from "@storyflow/state";
import {
  getFieldConfig,
  getFieldConfigArray,
  setFieldConfig,
} from "shared/getFieldConfig";
import { AnyOp, targetTools } from "shared/operations";
import { getConfig } from "shared/initialValues";
import {
  createComputationTransformer,
  extractRootRecord,
  getSyntaxTreeRecord,
  getFieldRecord,
  getGraph,
} from "shared/computation-tools";
import { isSyntaxTree } from "@storyflow/backend/syntax-tree";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";
import { getNextState, getPickedDocumentIds } from "shared/computation-tools";
import { createStages, Update } from "../aggregation/stages";
import util from "util";
import {
  ZodServerPackage,
  ZodDocumentOp,
  ZodToggle,
  ZodSplice,
} from "../collab-utils/zod";
import {
  client,
  getHistoriesFromIds,
  sortHistories,
  resetHistory,
  modifyValues,
} from "../collab-utils/redis-client";
import {
  computeFieldId,
  getDocumentId,
  getRawFieldId,
  getTemplateDocumentId,
  isFieldOfDocument,
  isNestedDocumentId,
  isTemplateField,
} from "@storyflow/backend/ids";
import { parseDocument } from "./documents";
import { deduplicate, getImports, getSortedValues } from "./helpers";
import fs from "fs";
import { createSyntaxStream } from "shared/parse-syntax-stream";
import { createTokenStream, parseTokenStream } from "shared/parse-token-stream";
import { tokens } from "@storyflow/backend/tokens";

export const fields = createRoute({
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
            z.union([
              ZodDocumentOp(ZodToggle(z.any())),
              ZodDocumentOp(ZodSplice(z.any())),
            ])
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

  save: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({
        id: z.string(),
        searchable: z.record(z.record(z.boolean())),
      });
    },
    async mutation(input, { dbName, slug }) {
      const documentId = input.id as DocumentId;
      const searchable = input.searchable;

      const db = (await clientPromise).db(dbName);

      const [article, histories] = await Promise.all([
        db
          .collection<DBDocumentRaw>("documents")
          .findOne({ _id: new ObjectId(documentId) }),
        (
          client.lrange(`${slug}:${documentId}`, 0, -1) as Promise<
            ServerPackage<any>[]
          >
        ).then((res) => sortHistories(res)),
      ]);

      /*
      console.log(
        "history",
        util.inspect(histories, { depth: null, colors: true })
      );
      */

      if (!article) {
        return error({ message: "No article found" });
      }

      let documentConfig = article.config;

      /*
      IMPORTANT ASSUMPTION 1
      We do NOT know the values of the document's imports (even though they are stored in the document).
      We need to fetch them first.
      The catch: we cannot fetch all imports in the first pass, since some import
      ids are computed from other imports (with "pick" function).
      */

      let computationRecord = extractRootRecord(
        documentId,
        getSyntaxTreeRecord(documentId, article),
        {
          excludeImports: true,
        }
      );

      console.log(
        "root record",
        util.inspect(computationRecord, { depth: null, colors: true })
      );

      const updatedFieldsIds: Set<FieldId> = new Set();

      const versions = article.versions ?? { config: 0 };

      const updatedTransforms: Set<FieldId> = new Set();

      if (documentId in histories) {
        const history = histories[documentId] ?? [];
        const templateVersion = article.versions?.config ?? 0;
        const pkgs = filterServerPackages(templateVersion, history);

        if (pkgs.length) {
          const configsBefore = getFieldConfigArray(documentConfig).map(
            (el) => ({ ...el })
          );
          documentConfig = transformDocumentConfig(documentConfig, pkgs);
          getFieldConfigArray(documentConfig)
            .map((el) => ({ ...el }))
            .forEach((el) => {
              const index = configsBefore.findIndex(({ id }) => id === el.id);
              if (
                index < 0 ||
                configsBefore[index].transform !== el.transform
              ) {
                updatedTransforms.add(el.id);
              }
            });
          versions.config = templateVersion + pkgs.length;
        }
      }

      const allUpdates: Record<
        FieldId,
        {
          initialTransform: Transform | undefined;
          stream: TokenStream;
        }
      > = {};

      (
        Object.entries(histories) as [
          DocumentId | RawFieldId,
          ServerPackage<any>[]
        ][]
      ).forEach(([id, history]) => {
        if (id === documentId) return;

        const fieldId = computeFieldId(documentId, id as RawFieldId);

        const fieldVersion = article.versions?.[id as RawFieldId] ?? 0;
        const pkgs = filterServerPackages(fieldVersion, history);

        if (!pkgs.length) return;

        const newUpdates = transformField(fieldId, computationRecord, pkgs);

        Object.assign(allUpdates, newUpdates);

        updatedFieldsIds.add(fieldId);
        versions[id as RawFieldId] = fieldVersion + pkgs.length;
      });

      // TODO
      // Skal tjekke ovenfor, om configs har fået ændret transforms.
      // Så laver jeg de felter til tokenStream og tilføjer dem til allUpdates uden initialTransform.
      // Herunder får de så tilføjet den nye transform, hvis den er der.

      updatedTransforms.forEach((id) => {
        if (id in allUpdates) return;
        allUpdates[id] = {
          initialTransform: undefined,
          stream: createTokenStream(
            computationRecord[id] ?? DEFAULT_SYNTAX_TREE
          ),
        };
      });

      const newRecord: SyntaxTreeRecord = Object.fromEntries(
        Object.entries(allUpdates).map(([id, { stream, initialTransform }]) => {
          const transform = getFieldConfig(
            documentConfig,
            id as FieldId
          )?.transform;
          return [id, parseTokenStream(stream, transform ?? initialTransform)];
        })
      );

      Object.assign(computationRecord, newRecord);

      // trim to not include removed nested fields
      computationRecord = extractRootRecord(documentId, computationRecord, {
        excludeImports: true,
      });

      console.log(
        "updated record",
        util.inspect(computationRecord, { depth: null, colors: true })
      );

      // TODO delete native fields from computationRecord that are not in documentConfig.

      let graph = getGraph(computationRecord);

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
        drefs.push(...getPickedDocumentIds(fieldId, computationRecord));
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
            $in: externalDocumentIds.map((el) => new ObjectId(el)),
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

      let fullRecord = { ...importsRecord, ...computationRecord };

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
                const newFieldId = computeFieldId(dref, node.data!.select);
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
            const value = createSyntaxStream(
              doc.record[id],
              (id) => new ObjectId(id)
            );
            const _imports = getFieldBlocksWithDepths(id, doc.record).filter(
              (el) => el.k.toHexString() !== id
            );
            derivatives.push({
              k: new ObjectId(id),
              v: value,
              depth: 0,
              result: doc.values[getRawFieldId(id)],
              // it does exist in values because template field values are always saved to values
              _imports,
              imports: [], // should just be empty
              nested: [],
              updated: true,
            });
          });
      });

      console.log(
        "DERIVATIVES",
        util.inspect(
          derivatives.map((el) => ({
            ...el,
            v: [],
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
          cached.push(new ObjectId(id));
        }
      });

      const stages: any = [
        {
          $set: {
            values: { $literal: values }, // uses $literal to do hard replace (otherwise: merges old with new values)
            fields: { $literal: fields },
            config: { $literal: documentConfig },
            versions: { $literal: versions },
            cached: cached as any,
            ...updated,
          },
        },
        ...createStages([], derivatives, { cache: Boolean(cached.length) }),
      ];

      const result1 = await db
        .collection<DBDocumentRaw>("documents")
        .findOneAndUpdate({ _id: new ObjectId(documentId) }, stages, {
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
          const value = createSyntaxStream(
            record[id],
            (id) => new ObjectId(id)
          );
          const objectId = new ObjectId(id);
          const _imports = getFieldBlocksWithDepths(id, record).filter(
            (el) => el.k.toHexString() !== id
          );
          return {
            k: objectId,
            v: value,
            depth: 0,
            result: doc.values[getRawFieldId(id)] ?? cachedRecord[id] ?? [],
            _imports,
            imports: [], // should just be empty
            nested: [],
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
            _id: { $ne: new ObjectId(documentId) },
          },
          stages,
          {
            writeConcern: { w: "majority" },
          }
        );

        await resetHistory(slug, documentId);

        return success(parseDocument(result1.value!));
      }

      return error({ message: "did not succeed" });
    },
  }),
});

const transformField = (
  fieldId: FieldId,
  initialRecord: SyntaxTreeRecord,
  pkgs: ServerPackage<AnyOp>[]
) => {
  const transformer = createComputationTransformer(fieldId, initialRecord);

  const updates: Record<
    FieldId,
    { initialTransform: Transform | undefined; stream: TokenStream }
  > = {};

  transformer(pkgs).forEach((pkg) => {
    unwrapServerPackage(pkg).operations.forEach((operation) => {
      const { location, field } = targetTools.parse(operation.target);
      const id = location === "" ? fieldId : (location as FieldId);
      if (!(id in updates)) {
        const initialValue =
          field && location === ""
            ? getConfig(field).defaultValue
            : DEFAULT_SYNTAX_TREE;

        const initialTransform =
          initialValue.type !== "root"
            ? {
                type: initialValue.type,
                ...(initialValue.data && { payload: initialValue.data }),
              }
            : undefined;

        updates[id] = {
          stream: createTokenStream(initialRecord[id] ?? initialValue),
          initialTransform,
        };
      }
      updates[id].stream = getNextState(updates[id].stream, operation);
    });
  });

  return updates;
};

const transformDocumentConfig = (
  config: DBDocument["config"],
  history: ServerPackage<AnyOp>[]
) => {
  let newConfig = [...config];

  history.forEach((pkg) => {
    unwrapServerPackage(pkg).operations.forEach((operation) => {
      if (targetTools.isOperation(operation, "document-config")) {
        operation.ops.forEach((action) => {
          const { index, insert, remove } = action;
          newConfig.splice(index, remove ?? 0, ...(insert ?? []));
        });
      } else if (targetTools.isOperation(operation, "property")) {
        const fieldId = targetTools.getLocation(operation.target) as FieldId;
        operation.ops.forEach((action) => {
          if (isTemplateField(fieldId)) {
            const templateId = getTemplateDocumentId(fieldId);
            const templateConfig = newConfig.find(
              (config): config is TemplateRef =>
                "template" in config && config.template === templateId
            );
            if (templateConfig) {
              if (!("config" in templateConfig)) {
                templateConfig.config = [];
              }
              let fieldConfigIndex = templateConfig.config!.findIndex(
                (config) => config.id === fieldId
              );
              if (fieldConfigIndex < 0) {
                templateConfig.config!.push({ id: fieldId });
                fieldConfigIndex = templateConfig.config!.length - 1;
              }
              if (action.name === "label" && action.value === "") {
                delete templateConfig.config![fieldConfigIndex][action.name];
              } else {
                templateConfig.config![fieldConfigIndex] = {
                  ...templateConfig.config![fieldConfigIndex],
                  [action.name]: action.value,
                };
              }
            }
          }

          newConfig = setFieldConfig(newConfig, fieldId, (ps) => ({
            ...ps,
            [action.name]: action.value,
          }));
        });
      }
    });
  });

  return newConfig;
};

const getFieldBlocksWithDepths = (
  fieldId: FieldId,
  record: SyntaxTreeRecord
) => {
  const graph = getGraph(record);
  const fieldRecord = getFieldRecord(record, fieldId, graph);
  const { fields } = getSortedValues(fieldRecord, graph, { keepDepths: true });
  return fields;
};
