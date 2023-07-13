import { RPCError, isError } from "@nanorpc/server";
import { client } from "../mongo";
import { z } from "zod";
import { createFieldRecordGetter } from "@storyflow/cms/get-field-record";
import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";
import type {
  ApiConfig,
  AppConfig,
  LibraryConfig,
  PropConfigRecord,
} from "@storyflow/shared/types";
import type { DBDocumentRaw } from "../types";
import { getUrlParams } from "../convert";
import { getPaths } from "../paths";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import {
  createRawTemplateFieldId,
  createTemplateFieldId,
} from "@storyflow/cms/ids";
import { createObjectId } from "../mongo";
import { createFetcher, findDocumentByUrl } from "../create-fetcher";
import { globals } from "../globals";
import { cors, procedure } from "@storyflow/server/rpc";

const modifyValues = <Input, Output>(
  obj: Record<string, Input>,
  callback: (val: Input, key: string, index: number) => Output
): Record<string, Output> =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value], index) => [
      key,
      callback(value, key, index),
    ])
  );

export const app = (appConfig: AppConfig, apiConfig: ApiConfig) => {
  const dbName = undefined; // config.workspaces[0].db;
  return {
    config: procedure.use(cors(apiConfig.cors)).query(() => {
      const configs: Record<string, LibraryConfig> = modifyValues(
        appConfig.configs,
        (libraryConfig, libraryName) => {
          const exists = new Set(Object.keys(libraryConfig.configs));
          const entries = Object.entries(libraryConfig.configs);

          const modifyProps = (props: PropConfigRecord): PropConfigRecord => {
            return modifyValues(props, (el) => {
              if (el.type === "group") {
                return {
                  ...el,
                  props: modifyProps(el.props) as typeof el.props,
                };
              }

              if (!("options" in el) || el.options === undefined) {
                return el;
              }

              if (Array.isArray(el.options)) {
                return {
                  ...el,
                  options: el.options.map((el) => {
                    if (typeof el === "object") {
                      return el;
                    }
                    return { value: el };
                  }),
                };
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
                  return {
                    value: libraryName ? `${libraryName}:${name}` : name,
                  };
                }),
              };
            });
          };

          let i = 0;
          while (i < entries.length) {
            const entry = entries[i];
            const { component, stories, props, provideContext, ...data } =
              entry[1];
            entries[i] = [
              entry[0],
              {
                ...data,
                props: modifyProps(props),
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

      return {
        ...appConfig,
        configs,
      };
    }),

    revalidate: procedure
      .use(globals(apiConfig))
      .schema(z.array(z.string()))
      .mutate(async (paths) => {
        try {
          await Promise.all(paths.map((path) => apiConfig.revalidate?.(path)));
          return { revalidated: true };
        } catch (err) {
          return new RPCError({
            code: "SERVER_ERROR",
            message: "Failed to revalidate",
          });
        }
      }),

    getPage: procedure
      .use(cors(apiConfig.cors))
      .schema(z.string())
      .query(async (url) => {
        if (!url.startsWith("/")) {
          return new RPCError({
            status: 403,
            code: "INVALID_INPUT",
            message: "Invalid url",
          });
        }

        const doc = await findDocumentByUrl({
          url,
          namespaces: appConfig.namespaces,
          dbName,
        });

        if (!doc) {
          console.log("NO PAGE");
          return null;
        }

        const params = getUrlParams(url);

        const getFieldRecord = createFieldRecordGetter(
          doc.record,
          params,
          createFetcher(dbName)
        );

        const [pageRecord, layoutRecord, opengraphRecord] = await Promise.all([
          getFieldRecord(
            createTemplateFieldId(doc._id, DEFAULT_FIELDS.page.id)
          ),
          getFieldRecord(
            createTemplateFieldId(doc._id, DEFAULT_FIELDS.layout.id)
          ),
          getFieldRecord(
            createTemplateFieldId(doc._id, DEFAULT_FIELDS.og_image.id)
          ),
        ]);

        const titleArray = calculateRootFieldFromRecord(
          createTemplateFieldId(doc._id, DEFAULT_FIELDS.label.id),
          doc.record
        );

        const result = {
          page: pageRecord,
          layout: layoutRecord,
          opengraph: opengraphRecord,
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

        return result;
      }),

    getPaths: procedure.use(cors(apiConfig.cors)).query(async () => {
      console.log("REQUESTING PATHS");

      const db = await client.get(dbName);
      const docs = await db
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
                [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`]: {
                  $exists: true,
                },
              }),
        })
        .toArray();

      const paths = await getPaths(docs, createFetcher(dbName));

      return paths;
    }),

    submit: procedure
      .use(cors(apiConfig.cors))
      .schema(
        z.object({
          id: z.string(),
          action: z.string(),
          data: z.record(
            z.array(z.union([z.string(), z.object({ src: z.string() })]))
          ),
        })
      )
      .mutate(async ({ action, id, data }, { req }) => {
        const url =
          "/" +
            req!.headers
              .get("referer")
              ?.replace(/https?:\/\//, "")
              .split("/")
              .slice(1)
              .join("/") ?? "";

        const body = JSON.stringify({
          input: {
            id,
            action,
            data,
            url,
            ...(appConfig.namespaces && {
              namespaces: appConfig.namespaces,
            }),
          },
        });

        const response = await fetch(
          `${appConfig.mainBaseURL}/api/documents/submit`,
          {
            method: "POST",
            body,
          }
        );
        const json = await response.json();

        if (isError(json)) {
          return new RPCError({
            code: json.error,
          });
        }
      }),
  };
};
