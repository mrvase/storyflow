import { createProcedure, createRoute, MiddlewareContext } from "@sfrpc/server";
import bcrypt from "bcryptjs";
import clientPromise from "../mongo/mongoClient";
import { z } from "zod";

import { cors as corsFactory } from "../middleware/cors";

import { createSessionStorage } from "@storyflow/session";
import { cookieOptions } from "../cookie-options";
import { error, success } from "@storyflow/result";
import {
  calculate,
  calculateRootFieldFromRecord,
  FolderFetch,
  StateGetter,
} from "@storyflow/backend/calculate";
import type {} from "@storyflow/frontend/types";
import {
  ClientSyntaxTree,
  DBDocument,
  DBDocumentRaw,
  DocumentId,
  FieldId,
  NestedDocument,
  NestedDocumentId,
  NestedFolder,
  RawFieldId,
  SyntaxTreeRecord,
  ValueArray,
} from "@storyflow/backend/types";
import { DEFAULT_FIELDS } from "@storyflow/backend/fields";
import { ObjectId } from "mongodb";
import { parseDocument } from "../routes/documents";
import { getFieldRecord, getGraph } from "shared/computation-tools";
import {
  computeFieldId,
  createRawTemplateFieldId,
  createTemplateFieldId,
  getDocumentId,
  getIdFromString,
  getRawDocumentId,
  getRawFieldId,
} from "@storyflow/backend/ids";
import util from "util";

const sessionStorage = createSessionStorage({
  cookie: cookieOptions,
});

const authorization = async (ctx: MiddlewareContext) => {
  const session = await sessionStorage.get(ctx.req.headers["cookie"]);

  let user: { slug: string; db: string } | null =
    session.get("api-user") ?? null;

  if (!user) {
    let auth = ctx.req.headers["x-storyflow"] as string;

    if (!auth) {
      throw error({ message: "Not authorized.", status: 401 });
    }

    auth = auth.replace("Basic ", "");

    const result = Buffer.from(auth, "base64").toString();

    const [domainIdAndSlug, key] = result.split(":");
    const [domainId, slug] = domainIdAndSlug.split("@");

    const organization = await (await clientPromise)
      .db("cms")
      .collection("organizations")
      .findOne({ slug });

    console.log("**** GETTING ORGANIZATION");

    if (!organization) {
      throw error({ message: "Not authorized.", status: 401 });
    }

    const fromDb = organization.keys[domainId] as string | undefined;

    if (!fromDb) {
      throw error({ message: "Not authorized.", status: 401 });
    }

    const success = await bcrypt.compare(key, fromDb);

    if (!success) {
      throw error({ message: "Not authorized.", status: 401 });
    }

    user = {
      slug: organization.slug,
      db: organization.dbs[organization.version],
    };

    session.set("user-api", user);
    const cookie = await sessionStorage.commit(session);
    ctx.res.setHeader("Set-Cookie", cookie);
  }

  return {
    slug: user!.slug,
    dbName: user!.db,
  };
};

const createElementRecordGetter = (
  docRecord: SyntaxTreeRecord,
  dbName: string,
  context: Record<string, ValueArray>
) => {
  const graph = getGraph(docRecord);

  return async (fieldId: FieldId) => {
    const nestedFields = getFieldRecord(docRecord, fieldId, {
      children: graph.children,
      imports: new Map(), // do not include imports in record
    });

    let record: Record<FieldId, ValueArray | ClientSyntaxTree> = {};

    let fetchRequests: FolderFetch[] = [];
    let fetched = new Set<NestedFolder>();
    let fetchFilters = new Map<
      NestedFolder,
      Record<RawFieldId, ValueArray>[]
    >();
    let fetchResults = new Map<NestedFolder, NestedDocument[]>();
    let documents = new Map<DocumentId, DBDocument>();

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

          const client = await clientPromise;
          const result = await client
            .db(dbName)
            .collection<DBDocumentRaw>("documents")
            .find({ folder: new ObjectId(el.folder.folder), ...filters })
            .sort({ _id: 1 })
            .limit(el.limit)
            .toArray();

          const articles = result.map(parseDocument);

          let list: NestedDocument[] = [];

          articles.forEach((el) => {
            list.push({ id: el._id });
            documents.set(el._id, el);
          });

          fetchResults.set(el.folder, list);
        })
      );
    };

    const calculateFilters = async (fetches: FolderFetch[]) => {
      const oldFetches = [...fetchRequests];

      fetches.forEach((el) => {
        const filterEntries = Object.entries(docRecord)
          .filter(([key]) => key.startsWith(getRawDocumentId(el.folder.id)))
          .map(([key, value]) => [
            `values.${getRawFieldId(key as FieldId)}`,
            calculate(value, getState),
          ]);
        const filters = Object.fromEntries(
          filterEntries
            .filter(([, value]) => Array.isArray(value) && value.length > 0)
            .map(([key, value]) => [key, { $elemMatch: { $in: value } }])
        );
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
      if (typeof importer === "object" && "folder" in importer) {
        const { folder, limit, sort } = importer;
        if (!fetchResults.has(folder)) {
          fetchRequests.push({ folder, limit, ...(sort && { sort }) });
          return [];
        }
        return fetchResults.get(folder);
      } else if (typeof importer === "object" && "ctx" in importer) {
        return context[importer.ctx] ?? [];
      } else if (typeof importer === "object" && "loop" in importer) {
        const dataFieldId = computeFieldId(
          getDocumentId(importer.loop),
          getIdFromString("data")
        );
        const rawFieldId = getRawFieldId(importer.loop);
        return calculate(
          {
            type: "select",
            children: [
              {
                id: "ffffffffffffffffffffffff" as NestedDocumentId,
                field: dataFieldId,
              },
            ],
            data: rawFieldId,
          },
          getState
        );
      } else {
        if (importer in docRecord) {
          return calculate(docRecord[importer], getState);
        }
        const documentId = getDocumentId(importer);
        const fetchedDoc = documents.get(documentId as DocumentId);
        const value = fetchedDoc?.record[importer];
        if (value) {
          return calculate(value, getState);
        }
        return [];
      }
    };

    const calculateAsync = async () => {
      const oldFetches = [...fetchRequests];

      record = Object.fromEntries(
        Object.entries(nestedFields).map(([key, tree]) => {
          return [key as FieldId, calculate(tree, getState)];
        })
      );

      const newFetches = fetchRequests.filter((el) => !oldFetches.includes(el));

      if (newFetches.length > 0) {
        console.log("NEW FETCHES NEW FETCHES NEW FETCHES NEW FETCHES");
        await resolveFetches(newFetches);
        calculateAsync();
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

export const public_ = createRoute({
  get: createProcedure({
    middleware(ctx) {
      return ctx.use(corsFactory("allow-all"), authorization);
    },
    schema() {
      return z.object({
        namespaces: z.array(z.union([z.string(), z.number()])).optional(),
        url: z.string(),
      });
    },
    async query({ namespaces, url }, { dbName }) {
      console.log("REQUESTING PAGE", dbName, url);

      const client = await clientPromise;

      const regex = `^${url
        .split("/")
        .map((el, index) => (index === 0 ? el : `(${el}|\\*)`))
        .join("/")}$`;

      const docRaw = await client
        .db(dbName)
        .collection("documents")
        .findOne<DBDocumentRaw>({
          ...(namespaces &&
            namespaces.length > 0 && {
              folder: {
                $in: namespaces.map(
                  (el) => new ObjectId(`${el}`.padStart(24, "0"))
                ),
              },
            }),
          [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`]:
            url.indexOf("/") < 0
              ? url
              : {
                  $regex: regex,
                },
        });

      if (!docRaw) {
        console.log("NO PAGE");
        return success(null);
      }

      const doc = parseDocument(docRaw);

      const params = Object.fromEntries(
        url
          .split("/")
          .reverse()
          .map((el, index) => [`param${index}`, [el]])
      );

      const getElementRecord = createElementRecordGetter(doc.record, dbName, {
        ...params,
      });

      const [pageRecord, layoutRecord] = await Promise.all([
        getElementRecord(
          createTemplateFieldId(doc._id, DEFAULT_FIELDS.page.id)
        ),
        getElementRecord(
          createTemplateFieldId(doc._id, DEFAULT_FIELDS.layout.id)
        ),
      ]);

      const titleArray = calculateRootFieldFromRecord(
        createTemplateFieldId(doc._id, DEFAULT_FIELDS.label.id),
        doc.record
      );

      const result = {
        page: pageRecord,
        layout: layoutRecord,
        head: {
          ...(typeof titleArray[0] === "string" && { title: titleArray[0] }),
        },
      };

      console.log("RESULT");

      return success(result);
    },
  }),
  getPaths: createProcedure({
    middleware(ctx) {
      return ctx.use(corsFactory("allow-all"), authorization);
    },
    schema() {
      return z.object({
        namespaces: z.array(z.union([z.string(), z.number()])).optional(),
      });
    },
    async query({ namespaces }, { dbName, slug }) {
      console.log("REQUESTING PATHS");

      const client = await clientPromise;
      const articles = await client
        .db(dbName)
        .collection<DBDocumentRaw>("documents")
        .find({
          ...(namespaces
            ? {
                folder: {
                  $in: namespaces.map(
                    (n) => new ObjectId(`${n}`.padStart(24, "0"))
                  ),
                },
              }
            : {
                [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`]: {
                  $exists: true,
                },
              }),
          /*
          [`values.${URL_ID}`]: namespace
            ? { $regex: `^${namespace}` }
            : { $exists: true },
          */
        })
        .toArray();

      const urls = articles
        .map((el) => {
          const doc = parseDocument(el);
          return {
            _id: doc._id,
            url: el.values[
              createRawTemplateFieldId(DEFAULT_FIELDS.url.id)
            ][0] as string,
            record: doc.record,
          };
        })
        .sort((a, b) => {
          if (a.url.length < b.url.length) {
            return -1;
          }
          if (a.url.length > b.url.length) {
            return 1;
          }
          return 0;
        });

      const dynamicUrls = urls.filter((el) => el.url.indexOf("*") > 0);
      const ordinaryUrls = urls.filter((el) => el.url.indexOf("*") < 0);

      const staticUrls = (
        await Promise.all(
          dynamicUrls.map(async ({ _id, url, record }) => {
            const fieldId = createTemplateFieldId(
              _id,
              DEFAULT_FIELDS.params.id
            );
            const tree = record[fieldId];

            const toUrl = (slug: string) => {
              return `${url.slice(0, -1)}${slug}`;
            };

            if (
              tree.children.every((el): el is string => typeof el === "string")
            ) {
              return tree.children.map(toUrl);
            }

            // wrap in select
            record[fieldId] = {
              type: "select",
              children: [
                {
                  type: "fetch",
                  children: [record[fieldId]],
                  data: [100],
                },
              ],
              data: createRawTemplateFieldId(DEFAULT_FIELDS.slug.id),
            };

            const getElementRecord = createElementRecordGetter(
              record,
              dbName,
              {}
            );

            const slugs =
              (
                await getElementRecord(
                  createTemplateFieldId(_id, DEFAULT_FIELDS.params.id)
                )
              )?.entry ?? [];

            if (!Array.isArray(slugs)) {
              throw new Error("Slugs cannot rely on client state");
            }

            if (slugs.every((el): el is string => typeof el === "string")) {
              return slugs.map(toUrl);
            }

            return [];
          })
        )
      ).flat(1);

      /*
      console.log("ORDINARY URLS", ordinaryUrls);
      console.log("DYNAMIC URLS", dynamicUrls);
      console.log("STATIC URLS", staticUrls);
      */

      return success([...ordinaryUrls.map((el) => el.url), ...staticUrls]);
    },
  }),
  /*
  search: createProcedure({
    middleware(ctx) {
      return ctx.use(corsFactory("allow-all"), authorization);
    },
    schema() {
      return z.string();
    },
    async mutation(query, { dbName }) {
      const client = await clientPromise;
      const articles = await client
        .db(dbName)
        .collection("documents")
        .aggregate([
          {
            $search: {
              index: dbName,
              text: {
                query,
                path: `values.${createRawTemplateFieldId(
                  DEFAULT_FIELDS.page.id
                )}`,
              },
              highlight: {
                path: `values.${createRawTemplateFieldId(
                  DEFAULT_FIELDS.page.id
                )}`,
              },
            },
          },
          {
            $project: {
              _id: 0,
              value: `$values.${createRawTemplateFieldId(
                DEFAULT_FIELDS.page.id
              )}`,
              score: { $meta: "searchScore" },
              highlight: { $meta: "searchHighlights" },
            },
          },
        ])
        .toArray();
      return success(articles as DBDocument[]);
    },
  }),
  */
});
