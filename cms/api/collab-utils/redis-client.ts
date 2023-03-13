import { Redis } from "@upstash/redis";
import { ServerPackage } from "@storyflow/state";
import { RawDocumentId } from "@storyflow/backend/types";

export const client = new Redis({
  url: "https://eu1-renewed-albacore-38555.upstash.io",
  token:
    "AZabASQgMTJiNTQ4YjQtN2Q1ZS00YWUwLWE4MDAtNmQ4MDM5NDdhMTBkYmFkZDBkOTI4ZWRhNGIzYWE0OGNmMjVhMGY4YmE3YzQ=",
});
export const getHistoriesFromIds = async (
  slug: string,
  keys: RawDocumentId[]
) => {
  if (keys.length === 0) return {};

  let getPipeline = client.pipeline();

  keys.forEach((key) => {
    getPipeline.lrange(`${slug}:${key}`, 0, -1);
  });

  const result = await getPipeline.exec();

  const object = Object.fromEntries(
    result.map((value, index) => [
      `${keys[index]}`,
      (value ?? []) as ServerPackage<any>[],
    ])
  );

  return object;
};
export const resetHistory = async (slug: string, id: RawDocumentId) => {
  const pipeline = client.pipeline();
  try {
    pipeline.del(`${slug}:${id}`);
    // pipeline.lpush(id, JSON.stringify(VERSION));
    return await pipeline.exec();
  } catch (err) {
    console.log(err);
  }
};
export const sortHistories = (
  array: ServerPackage<any>[]
): Record<string, ServerPackage<any>[]> => {
  return array.reduce((acc: Record<string, ServerPackage<any>[]>, cur) => {
    if (!acc[cur[0]]) {
      acc[cur[0]] = [];
    }
    const a = acc[cur[0]];
    a.push(cur as never);
    return acc;
  }, {});
};

export const modifyValues = <T extends any, V extends Record<string, any>>(
  obj: V,
  callback: (val: any) => T
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, callback(value)])
  ) as Record<string, T>;
