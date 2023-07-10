import { DocumentId, FolderId } from "@storyflow/shared/types";

export function shortenUrlId(id: DocumentId | FolderId) {
  if (id.startsWith("000000000000")) {
    return parseInt(id, 16).toString(16);
  }
  return id;
}

export function parseUrlId(id: string) {}
