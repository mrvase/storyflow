import { onInterval } from "@storyflow/state";
import { useSubject } from "../state/useSubject";
import { TimelineEntry } from "@storyflow/collab/types";
import { Timeline, createTimeline } from "@storyflow/collab/Timeline";
import { purgeTimelines, batchSyncTimelines } from "./batching";
import { createDocumentTransformer } from "operations/apply";
import { SyntaxTreeRecord } from "@storyflow/fields-core/types";

export function createCollaboration(
  mutation: Parameters<typeof batchSyncTimelines>[1],
  options: { duration?: number } = {}
) {
  const { duration = 2500 } = options;

  const foldersTimeline = createTimeline();
  const newDocumentsTimeline = createTimeline();
  const documentTimelines = new Map<string, Timeline>();

  const [registerEventListener, emitEvent] = useSubject<"loading" | "done">(
    "done"
  );

  const sync = async (index: number, force?: boolean) => {
    emitEvent("loading");
    const map = new Map(documentTimelines);
    if (index % 3 === 0) {
      // only sync folders every 3rd sync
      map.set("folders", foldersTimeline);
    }
    const result = await batchSyncTimelines(map, mutation);
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

    getTimeline(id: string) {
      if (id === "folders") {
        return foldersTimeline;
      }
      return documentTimelines.get(id);
    },

    initializeTimeline(
      id: string,
      {
        initialData,
        timeline,
        versions,
      }: {
        initialData: SyntaxTreeRecord;
        timeline: TimelineEntry[];
        versions: Record<string, number> | number;
      }
    ) {
      if (id === "folders") {
        foldersTimeline.initialize({
          timeline,
          versions,
        });
        return foldersTimeline;
      }
      let exists = documentTimelines.get(id);
      if (!exists) {
        exists = createTimeline();
        documentTimelines.set(id, exists);
      }
      exists.initialize({
        timeline,
        versions,
        transform: createDocumentTransformer(initialData),
      });
      return exists;
    },
  };
}
