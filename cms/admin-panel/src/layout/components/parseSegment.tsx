import type { DocumentId, FieldId, FolderId } from "@storyflow/shared/types";
import { ROOT_FOLDER } from "@storyflow/cms/constants";

type SegmentType =
  | {
      type: "folder";
      id: FolderId;
    }
  | {
      type: "app";
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

export function parseSegment<T extends SegmentType["type"]>(
  segment: string
): {
  [K in SegmentType["type"]]: Extract<SegmentType, { type: K }>;
}[T] {
  const normalized = segment.split("/").slice(-1)[0];

  if (normalized === "") {
    return {
      type: "folder",
      id: ROOT_FOLDER,
    } as any;
  }

  const type = normalized.slice(0, 1);
  const id = normalized.slice(1).padStart(24, "0");

  return {
    type: {
      f: "folder",
      a: "app",
      d: "document",
      t: "template",
      c: "field",
    }[type],
    id,
  } as any;
}
