import type { RouteConfig } from "../layout/panel-router/types";
import { SystemFolderPage } from "./SystemFolderPage";
import { SystemTemplatePage } from "./SystemTemplatePage";
import FolderPage from "../folders/FolderPage";
import { DocumentPage } from "../documents/DocumentPage";
import { FieldPage } from "../fields/FieldPage";

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
    matcher: /^(d|t).*/,
    component: ({ children }) => <DocumentPage>{children}</DocumentPage>,
  },
  {
    matcher: /^c.*/,
    component: ({ children }) => <FieldPage>{children}</FieldPage>,
  },
];
