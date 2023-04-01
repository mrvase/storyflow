import { DBFolder } from "@storyflow/backend/types";
import { unwrap } from "@storyflow/result";
import { Client, cache } from "../client";

export async function fetchFolder(
  id: string,
  client: Client
): Promise<DBFolder | undefined> {
  const result = await client.folders.get.query(undefined, {
    cache,
  });
  return unwrap(result).folders.find((folder) => folder._id === id);
}
