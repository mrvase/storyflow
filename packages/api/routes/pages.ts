import { createProcedure, createRoute } from "@storyflow/rpc-server";
import { getClientPromise } from "../mongoClient";
import { z } from "zod";

import { cors as corsFactory } from "@storyflow/server/middleware";

import { success } from "@storyflow/rpc-server/result";
import { createFieldRecordGetter } from "@storyflow/cms/get-field-record";
import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";
import type { StoryflowConfig } from "@storyflow/shared/types";
import type { DBDocumentRaw } from "../types";
import { parseDocument } from "../convert";
import { getPaths } from "../paths";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import {
  createRawTemplateFieldId,
  createTemplateFieldId,
} from "@storyflow/cms/ids";
import { createObjectId } from "@storyflow/server/mongo";
import { createFetcher } from "../create-fetcher";

export const pages = (config: StoryflowConfig) => {
  const dbName = config.workspaces[0].db;
  return createRoute({
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
      async query({ namespaces, url }) {
        console.log("REQUESTING PAGE", dbName, url);

        const client = await getClientPromise();

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
          getFieldRecord(
            createTemplateFieldId(doc._id, DEFAULT_FIELDS.page.id)
          ),
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
      async query({ namespaces }) {
        console.log("REQUESTING PATHS");

        const client = await getClientPromise();
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
                  [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`]:
                    {
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
};
