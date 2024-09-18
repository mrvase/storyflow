import cl from "clsx";
import { SystemFolderPage } from "./SystemFolderPage";
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
import { awaitToken, updateOrganization } from "../clients/auth";
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
import { SystemFilePage } from "./SystemFilePage";
import { fetchConfigs } from "../AppConfigContext";

const ordinaryRoutes: Record<string, Route> = {
  home: {
    match: "/~",
    render: FolderPage,
    next: () => [
      ordinaryRoutes.folder,
      ordinaryRoutes.document,
      ordinaryRoutes.template,
      ordinaryRoutes.field,
      ordinaryRoutes.systemFilesWithPage,
      ordinaryRoutes.systemFiles,
      ordinaryRoutes.systemFolder,
    ],
  },
  systemFilesWithPage: {
    match: "/files/:page",
    render: SystemFilePage,
  },
  systemFiles: {
    match: "/files",
    render: SystemFilePage,
  },
  systemFolder: {
    match: "/folders",
    render: SystemFolderPage,
  },
  folder: {
    match: "/f/:id",
    render: FolderPage,
    loader: async ({ id }) => {
      await awaitToken();
      return await query.documents.find(
        { folder: id.padStart(24, "0"), limit: 150 },
        {
          onSuccess(result) {
            result.forEach((doc) => {
              cache.set(query.documents.findById(doc._id), (ps) =>
                ps ? ps : doc
              );
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
    loader: async ({ id }) => {
      await awaitToken();
      return await query.documents.findById(id.padStart(24, "0") as DocumentId);
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
  render: Panel,
  next: () => [panelRoute],
  subroutes: Object.values(ordinaryRoutes),
};

function Panels() {
  const onChange = React.useCallback((acts: any) => {
    let start: number | null = null;
    let end: number | null = null;
    for (let action of acts) {
      const { type, index } = action;
      if (type === "add") {
        end = index;
      }
      if (type === "delete") {
        start = index;
      }
    }
    if (start !== null && end !== null) {
      actions.move({ from: start, to: end });
    }
  }, []);

  const { pathname } = useLocation();
  const length = pathname.split("/~").length - 1;

  return (
    <div className={cl("relative w-full h-full flex overflow-hidden")}>
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
  match: ".*",
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
        history.navigate({ pathname: "/", search: "unauthorized=true" });
        return;
      }

      const configs = mutate(`${params.slug}/configs`, () =>
        fetchConfigs(result.config!.apps)
      );

      const folders = query.admin.getFolders(undefined, {
        onSuccess(data) {
          collab.initializeTimeline("folders", { versions: data.version });
        },
      });

      const documents = query.documents.findTemplates(undefined, {
        onSuccess(result) {
          result.forEach((doc) => {
            cache.set(query.documents.findById(doc._id), doc);
          });
        },
      });

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

      const result2 = await Promise.all([folders, documents, configs]);

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
