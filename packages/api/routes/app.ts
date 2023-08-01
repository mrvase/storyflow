import { RPCError, isError } from "@nanorpc/server";
import { client } from "../mongo";
import { z } from "zod";
import { createSharedFieldCalculator } from "@storyflow/cms/get-field-record";
import type {
  ApiConfig,
  AppConfig,
  ClientSyntaxTree,
  FieldId,
  LibraryConfig,
  NestedDocumentId,
  PropConfigRecord,
  ValueArray,
} from "@storyflow/shared/types";
import type { DBDocumentRaw } from "../types";
import { getUrlParams } from "../convert";
import { getPaths } from "../paths";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import {
  createRawTemplateFieldId,
  createTemplateFieldId,
  getIdFromString,
} from "@storyflow/cms/ids";
import { createObjectId } from "../mongo";
import { createFetcher, findDocumentByUrl } from "../create-fetcher";
import { globals } from "../middleware";
import { cors, procedure } from "@storyflow/server/rpc";
import { promiseFromEntries } from "../utils";
import util from "util";

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

const getUrl = (headers: Headers) => {
  return (
    "/" +
      headers
        .get("referer")
        ?.replace(/https?:\/\//, "")
        .split("/")
        .slice(1)
        .join("/") ?? ""
  );
};

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

        const calculateField = createSharedFieldCalculator(
          doc.record,
          params,
          createFetcher(dbName)
        );

        const fields = [
          "page",
          "layout",
          "og_image",
          "label",
          "seo_title",
          "seo_description",
        ] as const satisfies readonly (keyof typeof DEFAULT_FIELDS)[];

        const entries = fields.map(
          (field): [typeof field, ReturnType<typeof calculateField>] => [
            field,
            calculateField(
              createTemplateFieldId(doc._id, DEFAULT_FIELDS[field].id)
            ),
          ]
        );

        const records = await promiseFromEntries(entries);

        const toString = (record: (typeof records)[keyof typeof records]) => {
          if (!record || !Array.isArray(record.entry)) return;
          if (typeof record.entry[0] !== "string") return;
          return record.entry[0];
        };

        const result = {
          page: records.page,
          layout: records.layout,
          opengraph: records.og_image,
          head: {
            title: toString(records.seo_title) ?? toString(records.label),
            description: toString(records.seo_description),
          },
        };

        return result;
      }),

    getLoopWithOffset: procedure
      .use(cors(apiConfig.cors))
      .schema(z.object({ url: z.string(), id: z.string() }))
      .query(async ({ url, id }) => {
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

        const calculateField = createSharedFieldCalculator(
          doc.record,
          params,
          createFetcher(dbName)
        );

        const getPropId = (name: string) => {
          const rawDocumentId = id.slice(12, 24);
          return `${rawDocumentId}${getIdFromString(name)}` as FieldId;
        };

        const childrenId = getPropId("children");
        const dataId = getPropId("data");

        const records = await promiseFromEntries([
          ["children", calculateField(childrenId)],
          ["data", calculateField(dataId)],
        ]);

        if (!records.children || !records.data) {
          return new RPCError({ code: "NOT_FOUND" });
        }

        const record: Record<FieldId, ValueArray | ClientSyntaxTree> = {
          ...records.children.record,
          ...records.data.record,
          [childrenId]: records.children.entry,
          [dataId]: records.data.entry,
        };

        return record;
      }),

    getLoopComponent: procedure
      .use(cors(apiConfig.cors))
      .schema(
        z.object({
          id: z.string(),
          options: z.array(z.string()),
          offset: z.number(),
        })
      )
      .query(async ({ id: id_, options, offset }, { req }) => {
        const id = id_ as NestedDocumentId;
        const url = getUrl(req!.headers);

        const doc = await findDocumentByUrl({
          url,
          namespaces: appConfig.namespaces,
          dbName,
        });

        if (!doc) {
          console.log("NO PAGE");
          return null;
        }

        const getPropId = (name: string) => {
          const rawDocumentId = id.slice(12, 24);
          return `${rawDocumentId}${getIdFromString(name)}` as FieldId;
        };

        const params = getUrlParams(url);

        const calculateField = createSharedFieldCalculator(
          doc.record,
          params,
          createFetcher(dbName),
          {
            offsets: {
              [getPropId("data")]: offset,
            },
          }
        );

        const childrenId = getPropId("children");
        const dataId = getPropId("data");

        const records = await promiseFromEntries([
          ["data", calculateField(dataId)],
          ["children", calculateField(childrenId)],
        ]);

        if (!records.children || !records.data) {
          return new RPCError({ code: "NOT_FOUND" });
        }

        const record: Record<FieldId, ValueArray | ClientSyntaxTree> = {
          ...records.children.record,
          ...records.data.record,
          [childrenId]: records.children.entry,
          [dataId]: records.data.entry,
        };

        const component =
          apiConfig.createLoopComponent?.({ id, options, record }) ?? null;

        console.log(
          util.inspect(records.data.entry, { depth: null, colors: true })
        );

        try {
          const {
            renderToReadableStream,
          } = require(`react-server-dom-webpack/server.edge`);
          // second argument: JSON.parse((globalThis as any).__RSC_MANIFEST["/(pages)/[1]/page"]).clientModules
          const result = renderToReadableStream(component);
          return result;
        } catch (err) {
          return null;
        }
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
        const url = getUrl(req!.headers);

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
