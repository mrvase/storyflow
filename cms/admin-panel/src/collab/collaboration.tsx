import { onInterval } from "@storyflow/state";
import { useSubject } from "../state/useSubject";
import {
  CollabVersion,
  TimelineEntry,
  VersionRecord,
} from "@storyflow/collab/types";
import { Timeline, createTimeline } from "@storyflow/collab/Timeline";
import { purgeTimelines, batchSyncTimelines } from "./batching";
import { SyntaxTreeRecord } from "@storyflow/fields-core/types";
import { DocumentId } from "@storyflow/shared/types";
import { Result, isError, unwrap } from "@storyflow/result";

export function createCollaboration(options: {
  sync: Parameters<typeof batchSyncTimelines>[1];
  saveDocument?: (input: {
    record: SyntaxTreeRecord;
    versions: VersionRecord;
  }) => Promise<
    Result<{
      record: SyntaxTreeRecord;
      versions: VersionRecord;
    }>
  >;
  duration?: number;
}) {
  const { duration = 2500 } = options;

  const syncSingleTimeline = async (id: string): Promise<TimelineEntry[]> => {
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
        foldersTimeline.initialize(() => syncSingleTimeline(id), data);
        return foldersTimeline;
      }
      if (id === "documents") {
        newDocumentsTimeline.initialize(() => syncSingleTimeline(id), {
          versions: null,
        });
        return newDocumentsTimeline;
      }
      let exists = documentTimelines.get(id);
      if (!exists) {
        exists = createTimeline();
        documentTimelines.set(id, exists);
      }
      exists.initialize(() => syncSingleTimeline(id), data);
      return exists;
    },

    /*
    saveTimeline(doc: DBDocument) {
      documentTimelines.get(doc._id)!.save(async (timeline) => {
        const result = await options.saveDocument({
          record: doc.record,
          versions: doc.versions,
          timeline,
        });

        if (isSuccess(result)) {
          const newDocument = unwrap(result);
          return {
            status: "success",
            data: {
              versions: newDocument.versions,
              timeline: [],
              transform: createDocumentTransformer(newDocument.record),
            },
          };
        }

        return {
          status: "error",
        };
      });
    },
    */
  };
}
