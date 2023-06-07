import cl from "clsx";
import { SystemFolderPage } from "./SystemFolderPage";
import { SystemTemplatePage } from "./SystemTemplatePage";
import FolderPage from "../folders/FolderPage";
import { DocumentPage } from "../documents/DocumentPage";
import { FieldPage } from "../fields/FieldPage";
import { Route, createHistory, useLocation, useRoute } from "@nanokit/router";
import { ParallelRoutes, createEvents } from "@nanokit/router/routes/parallel";
import { Layout } from "../layout/components/Layout";
import { NestedTransitionRoutes } from "@nanokit/router/routes/nested-transition";
import React from "react";
import { Sortable } from "@storyflow/dnd";
import { PanelResizeHandle, PanelGroup } from "react-resizable-panels";
import { LinkReceiver } from "../layout/components/LinkReceiver";
import { Panel } from "../layout/components/Panel";
import { updateOrganization } from "../clients/auth";
import { query } from "../clients/client";
import { collab } from "../collab/CollabContext";
import { TEMPLATE_FOLDER } from "@storyflow/cms/constants";
import { cache } from "@nanorpc/client/swr";
import { cache as SWRCache, mutate } from "swr/_internal";
import { DocumentId } from "@storyflow/shared/types";
import {
  authServicesMutate,
  authServicesQuery,
} from "../clients/client-auth-services";
import { isError } from "@nanorpc/client";

const ordinaryRoutes: Record<string, Route> = {
  home: {
    match: "/~",
    render: FolderPage,
    next: () => [
      ordinaryRoutes.folder,
      ordinaryRoutes.document,
      ordinaryRoutes.template,
      ordinaryRoutes.field,
    ],
  },
  folder: {
    match: "/f/:id",
    render: FolderPage,
    loader: ({ id }) => {
      return query.documents.find(
        { folder: id.padStart(24, "0"), limit: 50 },
        {
          onSuccess(result) {
            result.forEach((doc) => {
              cache.set(query.documents.findById(doc._id), doc);
            });
          },
        }
      );
    },
    next: () => [
      ordinaryRoutes.folder,
      ordinaryRoutes.document,
      ordinaryRoutes.template,
      ordinaryRoutes.field,
    ],
  },
  document: {
    match: "/d/:id",
    render: DocumentPage,
    loader: ({ id }) => {
      return query.documents.findById(id.padStart(24, "0") as DocumentId);
    },
    next: () => [ordinaryRoutes.field],
  },
  template: {
    match: "/t/:id",
    render: DocumentPage,
    next: () => [ordinaryRoutes.field],
  },
  field: {
    match: "/c/:id",
    render: FieldPage,
    next: () => [ordinaryRoutes.field],
  },
};

export const actions = createEvents("parallel");

const panelRoute: Route = {
  match: (segment: string) => {
    const match = segment.split(/\/~/);
    if (match[1] === undefined) return;
    return `/~${match[1]}`;
  },
  render: PanelWrapper,
  next: () => [panelRoute],
  subroutes: Object.values(ordinaryRoutes),
};

function PanelWrapper() {
  const route = useRoute();
  const { pathname } = useLocation();
  const single = pathname.split("/~").length - 1 === 1;

  return (
    <>
      {route.index !== 0 && (
        <PanelResizeHandle
          className={cl("group h-full relative", "w-2")}
          style={{
            order: route.index,
          }}
        >
          <LinkReceiver index={route.index} id={`new-${route.accumulated}`} />
        </PanelResizeHandle>
      )}
      <Panel single={single}>
        <NestedTransitionRoutes />
      </Panel>
    </>
  );
}

function Panels() {
  const onChange = React.useCallback((actions: any) => {
    let start: number | null = null;
    let end: number | null = null;
    for (let action of actions) {
      const { type, index } = action;
      if (type === "add") {
        end = index;
      }
      if (type === "delete") {
        start = index;
      }
    }
    if (start !== null && end !== null) {
      actions.move({ start, end });
    }
  }, []);

  const { pathname } = useLocation();
  const length = pathname.split("/~").length - 1;

  return (
    <div className="relative w-full h-full flex overflow-hidden">
      <LinkReceiver index={0} edge="left" id="link-left" />
      <Sortable
        type="panels"
        id="panels"
        onChange={onChange}
        canReceive={{
          link: () => "ignore",
          move: ({ type }) => (type === "panels" ? "accept" : "ignore"),
        }}
      >
        <PanelGroup direction="horizontal">
          <ParallelRoutes id="parallel" maintainInsertionOrder />
        </PanelGroup>
      </Sortable>
      <LinkReceiver index={length} edge="right" id="link-right" />
    </div>
  );
}

const topParallelPanelsRoute = {
  match: "/~.*",
  render: Panels,
  subroutes: [panelRoute],
};

let cancelSync: (() => void) | null = null;

const clearCache = (opts: { exclude?: string[] } = {}) => {
  Array.from(SWRCache.keys()).forEach((key) => {
    if (opts.exclude && opts.exclude.includes(key)) return;
    mutate(key, undefined, { revalidate: false });
  });
};

const routes: Route[] = [
  {
    match: "/logout",
    async loader() {
      clearCache();
      await authServicesMutate.auth.logout();
      history.navigate("/");
    },
    await: true,
  },
  {
    match: "/:slug/:version([^~/]+)",
    render: Layout,
    next: () => [topParallelPanelsRoute],
  },
  {
    match: "/:slug",
    render: Layout,
    next: () => [topParallelPanelsRoute],
    async loader(params) {
      clearCache({ exclude: ["/auth/authenticateUser"] });
      const result = await updateOrganization(params.slug);
      if (isError(result)) {
        console.log("IS ERRROR", result);
        history.navigate({ pathname: "/", search: "unauthorized=true" });
        return;
      }

      const folders = query.admin.getFolders(undefined, {
        onSuccess(data) {
          collab.initializeTimeline("folders", { versions: data.version });
        },
      });

      const documents = query.documents.find(
        { folder: TEMPLATE_FOLDER, limit: 50 },
        {
          onSuccess(result) {
            result.forEach((doc) => {
              cache.set(query.documents.findById(doc._id), doc);
            });
          },
        }
      );

      cancelSync?.();
      cancelSync = collab.syncOnInterval();

      collab.initializeTimeline("folders");

      // initialized immediately (no external data)
      collab.initializeTimeline("documents", { versions: null });

      (() => {
        const timeline = collab.getTimeline("documents")!;
        return timeline.registerStaleListener(() => {
          timeline.initialize(
            async () => [],
            { versions: null },
            { resetLocalState: true, keepListeners: true }
          );
        });
      })();

      const result2 = await Promise.all([folders, documents]);

      const failure = result2.some((r) => isError(r));

      if (failure) {
        history.navigate({ pathname: "/", search: "unauthorized=true" });
      }
    },
    await: true,
  },
];

const history = createHistory({
  routes,
});

export const history_: any = history;

/*
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
    matcher: /^(d|t).+/,
    component: ({ children }) => <DocumentPage>{children}</DocumentPage>,
  },
  {
    matcher: /^c.+/,
    component: ({ children }) => <FieldPage>{children}</FieldPage>,
  },
];
*/
