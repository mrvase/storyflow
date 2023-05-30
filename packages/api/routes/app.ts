import { createProcedure, createRoute } from "@storyflow/rpc-server";
import { getClientPromise } from "../mongoClient";
import { z } from "zod";

import { cors } from "@storyflow/server/middleware";

import { error, success } from "@storyflow/rpc-server/result";
import { createFieldRecordGetter } from "@storyflow/cms/get-field-record";
import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";
import type {
  ApiConfig,
  AppConfig,
  LibraryConfig,
  PropConfigRecord,
  PropGroup,
} from "@storyflow/shared/types";
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
import { globals } from "../globals";

const modifyValues = <Result, V extends Record<string, any>>(
  obj: V,
  callback: (
    val: V extends Record<string, infer U> ? U : never,
    key: string,
    index: number
  ) => Result
): Record<string, Result> =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value], index) => [
      key,
      callback(value, key, index),
    ])
  ) as Record<string, Result>;

const handleContext = (
  context: Record<string, any> | ((arg: any) => Record<string, any>),
  props: PropConfigRecord
): Record<string, any> => {
  if (typeof context === "function") {
    const createProxy = (group?: string): any =>
      new Proxy(
        {},
        {
          get(_, prop: string) {
            const localProps = group
              ? (props[group] as PropGroup).props
              : props;
            if (!(prop in localProps)) {
              throw new Error(`Context property ${prop} not found`);
            }
            if (localProps[prop].type === "group") {
              return createProxy(prop);
            }
            return `{{${["props", group, prop].filter(Boolean).join(".")}}}`;
          },
        }
      );

    return context(createProxy());
  }
  return context;
};

export const app = (appConfig: AppConfig, apiConfig: ApiConfig) => {
  const dbName = undefined; // config.workspaces[0].db;
  return createRoute({
    config: createProcedure({
      middleware(ctx) {
        return ctx.use(cors(apiConfig.cors));
      },

      async query() {
        const configs: Record<string, LibraryConfig> = modifyValues(
          appConfig.configs,
          (libraryConfig, libraryName) => {
            const exists = new Set(Object.keys(libraryConfig.configs));
            const entries = Object.entries(libraryConfig.configs);

            let i = 0;
            while (i < entries.length) {
              const entry = entries[i];
              const { component, stories, props, context, ...data } = entry[1];
              entries[i] = [
                entry[0],
                {
                  ...data,
                  props: modifyValues(props, (el) => {
                    if (
                      !("options" in el) ||
                      typeof el.options !== "object" ||
                      Array.isArray(el.options)
                    ) {
                      return el;
                    }

                    Object.entries(el.options).forEach((entry) => {
                      if (exists.has(entry[0])) return;
                      entries.push(entry);
                      exists.add(entry[0]);
                    });

                    return {
                      ...el,
                      options: Object.keys(el.options).map((el) => {
                        const name = el.replace(/Config$/, "");
                        return libraryName ? `${libraryName}:${name}` : name;
                      }),
                    };
                  }),
                  ...(context && { context: handleContext(context, props) }),
                },
              ];
              i++;
            }

            return {
              ...libraryConfig,
              configs: Object.fromEntries(entries),
            };
          }
        );

        return success({
          ...appConfig,
          configs,
        });
      },
    }),

    revalidate: createProcedure({
      middleware(ctx) {
        return ctx.use(globals(apiConfig));
      },
      schema() {
        return z.array(z.string());
      },
      async mutation(paths) {
        try {
          await Promise.all(paths.map((path) => apiConfig.revalidate?.(path)));
          return success({ revalidated: true });
        } catch (err) {
          console.log("REVALIDATION ERROR", err);
          return error({ message: "Failed to revalidate" });
        }
      },
    }),

    getPage: createProcedure({
      middleware(ctx) {
        console.log("CONTEXT", ctx.request);
        return ctx.use(cors(apiConfig.cors));
      },
      schema() {
        return z.string();
      },
      async query(url) {
        if (!url.startsWith("/")) {
          return error({ message: "Invalid url" });
        }
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
            ...(appConfig.namespaces &&
              appConfig.namespaces.length > 0 && {
                folder: {
                  $in: appConfig.namespaces.map((el) =>
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
        return ctx.use(cors(apiConfig.cors));
      },
      async query() {
        console.log("REQUESTING PATHS");

        const client = await getClientPromise();
        const articles = await client
          .db(dbName)
          .collection<DBDocumentRaw>("documents")
          .find({
            ...(appConfig.namespaces
              ? {
                  folder: {
                    $in: appConfig.namespaces.map((n) =>
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
  });
};
