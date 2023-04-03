import { RouteConfig } from "../../panel-router/types";
import { DocumentId, FieldId, FolderId } from "@storyflow/backend/types";
import { SystemFolderPage } from "./SystemFolderPage";
import { SystemTemplatePage } from "./SystemTemplatePage";
import { ROOT_FOLDER } from "@storyflow/backend/constants";
import FolderPage from "../../folders/FolderPage";
import AppPage from "../../folders/AppPage";
import { DocumentPage } from "../../documents/DocumentPage";
import { FieldPage } from "../../fields/FieldPage";

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

export const routes: RouteConfig[] = [
  {
    matcher: /folders/,
    component: () => <SystemFolderPage />,
  },
  {
    matcher: /templates/,
    component: () => <SystemTemplatePage />,
  },
  {
    matcher: /^(f.*)?$/,
    component: ({ children }) => <FolderPage>{children}</FolderPage>,
  },
  {
    matcher: /^a.*/,
    component: ({ children }) => <AppPage>{children}</AppPage>,
  },
  {
    matcher: /^(d|t).*/,
    component: ({ children }) => <DocumentPage>{children}</DocumentPage>,
  },
  {
    matcher: /^c.*/,
    component: ({ children }) => <FieldPage>{children}</FieldPage>,
  },
];
