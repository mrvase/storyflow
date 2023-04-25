import type { RouteConfig } from "../../panel-router/types";
import { SystemFolderPage } from "./SystemFolderPage";
import { SystemTemplatePage } from "./SystemTemplatePage";
import FolderPage from "../../folders/FolderPage";
import AppPage from "../../folders/AppPage";
import { DocumentPage } from "../../documents/DocumentPage";
import { FieldPage } from "../../fields/FieldPage";

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
