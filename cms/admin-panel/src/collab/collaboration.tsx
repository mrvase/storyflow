import { useSubject } from "../state/useSubject";
import {
  CollabVersion,
  TimelineEntry,
  VersionRecord,
} from "@storyflow/collab/types";
import { Timeline, createTimeline } from "@storyflow/collab/Timeline";
import { purgeTimelines, batchSyncTimelines } from "./batching";
import { DocumentId } from "@storyflow/shared/types";
import { Result, isError, unwrap } from "@storyflow/rpc-client/result";
import { onInterval } from "./interval";

export function createCollaboration(options: {
  sync: Parameters<typeof batchSyncTimelines>[1];
  update: (input: {
    id: string;
    index: number;
  }) => Promise<Result<TimelineEntry[]>>;
  duration?: number;
}) {
  const { duration = 2500 } = options;

  const fetchSingleTimeline = async (id: string): Promise<TimelineEntry[]> => {
    const result = await options.sync({
      [id]: { entries: [], startId: null, length: 0 },
    });
    if (isError(result)) {
      return [];
    }
    return unwrap(result)[id].updates;
  };

  const foldersTimeline = createTimeline();
  const newDocumentsTimeline = createTimeline();
  const documentTimelines = new Map<DocumentId, Timeline>();

  const [registerEventListener, emitEvent] = useSubject<"loading" | "done">(
    "done"
  );

  const sync = async (index: number, force?: boolean) => {
    emitEvent("loading");
    const map = new Map<DocumentId | "documents" | "folders", Timeline>(
      documentTimelines
    );
    map.set("documents", newDocumentsTimeline);
    if (index % 3 === 0) {
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

    sync,
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

    initializeTimeline(
      id: DocumentId | "documents" | "folders",
      data?: {
        versions: VersionRecord | CollabVersion | null;
        transform?: (timeline: TimelineEntry[]) => TimelineEntry[];
        timeline?: TimelineEntry[];
      }
    ) {
      if (id === "folders") {
        foldersTimeline.initialize(() => fetchSingleTimeline(id), data);
        return foldersTimeline;
      }
      if (id === "documents") {
        newDocumentsTimeline.initialize(() => fetchSingleTimeline(id), {
          versions: null,
        });
        return newDocumentsTimeline;
      }
      let exists = documentTimelines.get(id);
      if (!exists) {
        exists = createTimeline();
        documentTimelines.set(id, exists);
      }
      exists.initialize(() => fetchSingleTimeline(id), data);
      return exists;
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
        return unwrap(result)[id];
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
          updated: unwrap(updated),
        };
      });
    },
  };
}
