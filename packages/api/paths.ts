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
        const fieldId = createTemplateFieldId(_id, DEFAULT_FIELDS.params.id);
        const tree = record[fieldId];

        const toUrl = (slug: string) => `${url.slice(0, -1)}${slug}`;

        if (tree.children.every((el): el is string => typeof el === "string")) {
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

        const getFieldRecord = createFieldRecordGetter(record, {}, fetcher);

        const slugs =
          (
            await getFieldRecord(
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

  return [...ordinaryUrls.map((el) => el.url), ...staticUrls];
}
