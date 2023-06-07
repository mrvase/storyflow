import { createGlobalState } from "../state/useSubject";
import {
  CollabVersion,
  TimelineEntry,
  VersionRecord,
} from "@storyflow/collab/types";
import { Timeline, createTimeline } from "@storyflow/collab/Timeline";
import { purgeTimelines, batchSyncTimelines } from "./batching";
import { DocumentId } from "@storyflow/shared/types";
import { onInterval } from "./interval";
import type { ErrorCodes } from "@storyflow/api";
import { isError } from "@nanorpc/client";

export function createCollaboration(options: {
  sync: Parameters<typeof batchSyncTimelines>[1];
  update: (input: {
    id: string;
    index: number;
  }) => Promise<TimelineEntry[] | ErrorCodes<string>>;
  duration?: number;
}) {
  const { duration = 5000 } = options;

  const fetchSingleTimeline = async (id: string): Promise<TimelineEntry[]> => {
    const result = await options.sync({
      [id]: { entries: [], startId: null, length: 0 },
    });
    if (isError(result)) {
      return [];
    }
    return result[id].updates;
  };

  const foldersTimeline = createTimeline({ debugId: "folders" });
  const newDocumentsTimeline = createTimeline({ debugId: "documents" });
  const documentTimelines = new Map<DocumentId, Timeline>();

  const [, emitEvent, registerEventListener] = createGlobalState<
    "loading" | "done"
  >("done");

  const sync = async (index?: number, force?: boolean) => {
    emitEvent("loading");
    const map = new Map<DocumentId | "documents" | "folders", Timeline>(
      documentTimelines
    );
    map.set("documents", newDocumentsTimeline);
    if (index === undefined || index % 3 === 0) {
      // only sync folders every 3rd sync
      map.set("folders", foldersTimeline);
    }
    const result = await batchSyncTimelines(map, options.sync);
    emitEvent("done");
    purgeTimelines(documentTimelines);
    return result;
  };

  return {
    registerEventListener,
    registerMutationListener() {},

    sync: () => {
      sync();
    },
    syncOnInterval() {
      return onInterval(
        (index, event) =>
          sync(index, event === "unload" || event === "visibilitychange"),
        { duration }
      );
    },

    getTimeline(id: DocumentId | "folders" | "documents") {
      if (id === "folders") {
        return foldersTimeline;
      }
      if (id === "documents") {
        return newDocumentsTimeline;
      }
      return documentTimelines.get(id);
    },

    async getInitializedTimelineAsync(
      id: DocumentId,
      data: {
        versions: VersionRecord | CollabVersion | null;
        transform: (timeline: TimelineEntry[]) => TimelineEntry[];
      }
    ) {
      let exists = documentTimelines.get(id);
      if (!exists) {
        exists = createTimeline({
          debugId: `doc ${parseInt(id, 16).toString(16)}`,
        });
        documentTimelines.set(id, exists);
      }
      return await exists.softInitializeAsync(
        () => fetchSingleTimeline(id),
        data
      );
    },

    initializeTimeline(
      id: DocumentId | "documents" | "folders",
      data?: {
        versions: VersionRecord | CollabVersion | null;
        transform?: (timeline: TimelineEntry[]) => TimelineEntry[];
      }
    ) {
      if (id === "folders") {
        return foldersTimeline.initialize(() => fetchSingleTimeline(id), data);
      }
      if (id === "documents") {
        return newDocumentsTimeline.initialize(() => fetchSingleTimeline(id), {
          versions: null,
        });
      } else {
        let exists = documentTimelines.get(id);
        if (!exists) {
          exists = createTimeline({
            debugId: `doc ${parseInt(id, 16).toString(16)}`,
          });
          documentTimelines.set(id, exists);
        }
        return exists.initialize(() => fetchSingleTimeline(id), data);
      }
    },

    async saveTimeline(
      id: DocumentId,
      callback: (timeline: TimelineEntry[]) => Promise<boolean>
    ): Promise<boolean> {
      const timeline = documentTimelines.get(id)!;

      const success = await timeline.sync(async (upload, state) => {
        const result = await options.sync({
          [id]: { entries: upload, ...state },
        });
        if (isError(result)) {
          return { status: "error" };
        }
        return result[id];
      });

      if (!success) return false;

      return await timeline.save(async (timeline) => {
        const result = await callback(timeline);

        if (!result) {
          return { status: "error" };
        }

        const updated = await options.update({ id, index: timeline.length });

        if (isError(updated)) {
          return { status: "error" };
        }

        return {
          status: "success",
          updated,
        };
      });
    },
  };
}
