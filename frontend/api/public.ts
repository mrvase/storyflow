import { createProcedure, createRoute, MiddlewareContext } from "@sfrpc/server";
import bcrypt from "bcryptjs";
import { clientPromise } from "./mongoClient";
import { z } from "zod";

import { cors as corsFactory } from "@storyflow/api-core/middleware";

import { createSessionStorage } from "@storyflow/session";
import { cookieOptions } from "./cookie-options";
import { error, success } from "@storyflow/result";
import { createFieldRecordGetter } from "@storyflow/fields-core/get-field-record";
import { calculateRootFieldFromRecord } from "@storyflow/fields-core/calculate-server";
import type {} from "@storyflow/shared/types";
import type { RawFieldId, ValueArray } from "@storyflow/shared/types";
import type { DBDocumentRaw } from "@storyflow/db-core/types";
import { parseDocument } from "@storyflow/db-core/convert";
import { getPaths } from "@storyflow/db-core/paths";
import { DEFAULT_FIELDS } from "@storyflow/fields-core/default-fields";
import {
  createRawTemplateFieldId,
  createTemplateFieldId,
} from "@storyflow/fields-core/ids";
import util from "node:util";
import type { FolderId } from "@storyflow/shared/types";
import { createObjectId } from "../../packages/api-core/mongo";

const sessionStorage = createSessionStorage({
  cookie: cookieOptions,
});

const createFetcher =
  (dbName: string) =>
  async (fetchObject: {
    folder: FolderId;
    filters: Record<RawFieldId, ValueArray>;
    limit: number;
    sort?: string[];
  }) => {
    const filters = Object.fromEntries(
      Object.entries(fetchObject.filters ?? {})
        .filter(([, value]) => Array.isArray(value) && value.length > 0)
        .map(([key, value]) => {
          return [`values.${key}`, { $elemMatch: { $in: value } }];
        })
    );

    const client = await clientPromise;
    const result = await client
      .db(dbName)
      .collection<DBDocumentRaw>("documents")
      .find({
        folder: createObjectId(fetchObject.folder),
        ...filters,
      })
      .sort({ _id: -1 })
      .limit(fetchObject.limit)
      .toArray();

    return result.map(parseDocument);
  };

export const public_ = createRoute({
  get: createProcedure({
    middleware(ctx) {
      return ctx
        .use
        // corsFactory("allow-all"),
        ();
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
                $in: namespaces.map((el) =>
                  createObjectId(`${el}`.padStart(24, "0"))
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

      const getFieldRecord = createFieldRecordGetter(
        doc.record,
        {
          ...params,
        },
        createFetcher(dbName)
      );

      const [pageRecord, layoutRecord] = await Promise.all([
        getFieldRecord(createTemplateFieldId(doc._id, DEFAULT_FIELDS.page.id)),
        getFieldRecord(
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

      /*
      console.log(
        "RESULT",
        util.inspect(result, { depth: null, colors: true })
      );
      */

      return success(result);
    },
  }),
  getPaths: createProcedure({
    middleware(ctx) {
      return ctx
        .use
        // corsFactory("allow-all"),
        // authorization
        ();
    },
    schema() {
      return z.object({
        namespaces: z.array(z.union([z.string(), z.number()])).optional(),
      });
    },
    async query({ namespaces }, { dbName }) {
      console.log("REQUESTING PATHS");

      const client = await clientPromise;
      const articles = await client
        .db(dbName)
        .collection<DBDocumentRaw>("documents")
        .find({
          ...(namespaces
            ? {
                folder: {
                  $in: namespaces.map((n) =>
                    createObjectId(`${n}`.padStart(24, "0"))
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

      const paths = await getPaths(articles, createFetcher(dbName));

      // console.log("PATHS", paths);

      return success(paths);
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
