import type { DocumentId, FieldId, FolderId } from "@storyflow/shared/types";
import { ROOT_FOLDER } from "@storyflow/cms/constants";
import { useMatches } from "@nanokit/router";

type SegmentType =
  | {
      type: "folder";
      id: FolderId;
    }
  | {
      type: "document";
      id: DocumentId;
    }
  | {
      type: "template";
      id: DocumentId;
    }
  | {
      type: "field";
      id: FieldId;
    };

export function parseMatch<T extends SegmentType["type"]>(
  match: ReturnType<typeof useMatches>[number]
): {
  [K in SegmentType["type"]]: Extract<SegmentType, { type: K }>;
}[T] {
  const letter = match.segment[1];

  const type = {
    f: "folder",
    d: "document",
    t: "template",
    c: "field",
  }[letter];

  if (!type) {
    return {
      type: "folder",
      id: ROOT_FOLDER,
    } as any;
  }

  return {
    type,
    id: match.params.id.padStart(24, "0"),
  } as any;
}
