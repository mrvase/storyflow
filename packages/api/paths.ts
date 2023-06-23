import {
  createRawTemplateFieldId,
  createTemplateFieldId,
} from "@storyflow/cms/ids";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { createFieldRecordGetter } from "@storyflow/cms/get-field-record";
import { parseDocument } from "./convert";
import { DBDocument } from "@storyflow/cms/types";
import { DBDocumentRaw } from "./types";
import { FolderId, RawFieldId, ValueArray } from "@storyflow/shared/types";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";
import { tokens } from "@storyflow/cms/tokens";

export async function getPaths(
  docs: DBDocumentRaw[],
  fetcher: (fetchObject: {
    folder: FolderId;
    filters: Record<RawFieldId, ValueArray>;
    limit: number;
  }) => Promise<DBDocument[]>
) {
  const urls = docs
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
        const paramsFieldId = createTemplateFieldId(
          _id,
          DEFAULT_FIELDS.params.id
        );

        // it might not exist yet
        const tree = record[paramsFieldId] ?? DEFAULT_SYNTAX_TREE;

        const toUrl = (slug: string) => `${url.slice(0, -1)}${slug}`;

        const children = tree.children.filter((el) => !tokens.isLineBreak(el));

        if (children.every((el): el is string => typeof el === "string")) {
          return children.map(toUrl);
        }

        // wrap in select
        record[paramsFieldId] = {
          type: "select",
          children: [
            {
              type: "fetch",
              children: [tree],
              data: [100],
            },
          ],
          data: createRawTemplateFieldId(DEFAULT_FIELDS.slug.id),
        };

        const getFieldRecord = createFieldRecordGetter(record, {}, fetcher);

        const slugs = (await getFieldRecord(paramsFieldId))?.entry ?? [];

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

  return [...ordinaryUrls.map((el) => el.url), ...staticUrls];
}
