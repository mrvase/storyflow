import {
  DocumentId,
  FolderId,
  FieldId,
  RawFieldId,
} from "@storyflow/shared/types";
import { TimelineEntry } from "@storyflow/collab/types";
import { useDocument } from ".";
import {
  createTransaction,
  filterTimeline,
  read,
} from "@storyflow/collab/utils";
import {
  DBDocument,
  DocumentConfig,
  DocumentVersionRecord,
} from "@storyflow/cms/types";
import {
  FieldTransform,
  SyntaxTree,
  SyntaxTreeRecord,
} from "@storyflow/cms/types";
import {
  applyConfigTransaction,
  applyFieldTransaction,
  createDocumentTransformer,
} from "../operations/apply";
import { TokenStream } from "../operations/types";
import {
  DocumentAddTransactionEntry,
  DocumentTransactionEntry,
  FieldTransactionEntry,
} from "../operations/actions";
import { DEFAULT_SYNTAX_TREE, TEMPLATE_FOLDER } from "@storyflow/cms/constants";
import { splitTransformsAndRoot } from "@storyflow/cms/transform";
import {
  createTokenStream,
  parseTokenStream,
} from "../operations/parse-token-stream";
import { usePush } from "../collab/CollabContext";
import { isTemplateDocument } from "@storyflow/cms/ids";
import { cache, useMutation } from "@nanorpc/client/swr";
import { mutate, query } from "../clients/client";
import { isError } from "@nanorpc/client";

const splitIntoQueues = (
  array: TimelineEntry[]
): Record<"config" | RawFieldId, TimelineEntry[]> => {
  return array.reduce((acc: Record<string, TimelineEntry[]>, cur) => {
    const queue = read(cur).queue;
    if (!acc[queue]) {
      acc[queue] = [];
    }
    const a = acc[queue];
    a.push(cur);
    return acc;
  }, {});
};

export const useSaveDocument = (
  documentId: DocumentId,
  folderId_: FolderId
) => {
  const { doc } = useDocument(documentId);

  const folderId = isTemplateDocument(documentId) ? TEMPLATE_FOLDER : folderId_;

  const push = usePush<DocumentAddTransactionEntry>("documents");

  const func = useMutation(mutate.documents.update, {
    onSuccess(result, input) {
      cache.set(query.documents.find({ folder: folderId, limit: 50 }), (ps) => {
        if (!ps) {
          return ps;
        }
        const index = ps.findIndex((el) => el._id === input.id);
        const newDocuments = [...ps];
        if (index >= 0) {
          newDocuments[index] = { ...newDocuments[index], ...result };
        } else {
          newDocuments.unshift(result);
        }
        return newDocuments;
      });

      cache.set(query.documents.findById(input.id), result);
    },
  });

  return async (timeline: TimelineEntry[]): Promise<boolean> => {
    if (!doc) return false;

    let config = doc.config;
    const versions: DocumentVersionRecord = doc.versions ?? { config: [0] };

    [timeline] = filterTimeline([timeline], versions);

    timeline = createDocumentTransformer(doc)(timeline);

    // split timeline into queues
    const queues = splitIntoQueues(timeline);

    const configQueue = queues["config"];

    const updatedVersions: Partial<DocumentVersionRecord> = {};

    if (configQueue?.length) {
      config = updateDocumentConfig(config, configQueue);
      const last = read(configQueue[configQueue.length - 1]);
      updatedVersions.config = [
        versions.config[0] + configQueue.length,
        last.prev,
        last.user,
      ];
    }

    const { record: updatedRecord, versions: updatedFieldVersions } =
      updateFieldRecord(
        {
          _id: documentId,
          versions,
          record: doc.record,
        },
        queues
      );

    Object.assign(updatedVersions, updatedFieldVersions);

    const input = {
      id: documentId,
      folder: folderId,
      record: updatedRecord,
      config,
      versions: updatedVersions,
    };

    console.log("INPUT", input);

    push(
      createTransaction((t) => {
        t.target(folderId);
        t.toggle({ name: "remove", value: documentId });
        return t;
      })
    );

    const result = await func(input);

    if (isError(result)) {
      push(
        createTransaction((t) => {
          t.target(folderId);
          t.toggle({ name: "add", value: documentId });
          return t;
        })
      );
    }

    return true;
  };
};

const updateFieldRecord = (
  article: Pick<DBDocument, "_id" | "record" | "versions">,
  queues: Record<RawFieldId, TimelineEntry[]>
) => {
  const updatedRecord: SyntaxTreeRecord = {};
  const updatedVersions: Partial<DocumentVersionRecord> = {};

  const entries = Object.entries(queues) as [
    "config" | RawFieldId,
    TimelineEntry[]
  ][];

  entries.forEach(([id, queue]) => {
    if (id === "config") return;

    if (!queue.length) return;

    // const fieldId = computeFieldId(article._id, id as RawFieldId);
    const newUpdates = transformField(article.record, queue);
    Object.assign(updatedRecord, newUpdates);

    const last = read(queue[queue.length - 1]);

    const index = article.versions?.[id as RawFieldId]?.[0] ?? 0;
    updatedVersions[id as RawFieldId] = [
      index + queue.length,
      last.prev,
      last.user,
    ];
  });

  return {
    record: updatedRecord,
    versions: updatedVersions,
  };
};

const transformField = (
  initialRecord: SyntaxTreeRecord,
  queue: TimelineEntry[]
): Record<FieldId, SyntaxTree> => {
  const updates: Record<
    FieldId,
    { stream: TokenStream; transforms: FieldTransform[] }
  > = {};

  queue.forEach((pkg) => {
    read<FieldTransactionEntry>(pkg).transactions.forEach((transaction) => {
      transaction.forEach((entry) => {
        const id = entry[0];
        if (!(id in updates)) {
          const value = initialRecord[id] ?? DEFAULT_SYNTAX_TREE;
          const [transforms, root] = splitTransformsAndRoot(value);

          updates[id] = {
            stream: createTokenStream(root),
            transforms,
          };
        }
        updates[id] = applyFieldTransaction(updates[id], entry);
      });
    });
  });

  return Object.fromEntries(
    Object.entries(updates).map(([id, { stream, transforms }]) => {
      return [
        id,
        parseTokenStream(
          stream,
          transforms.length > 0 ? transforms : undefined
        ),
      ];
    })
  );
};

const updateDocumentConfig = (
  config: DocumentConfig,
  queue: TimelineEntry[]
) => {
  let newConfig = [...config];

  queue.forEach((entry) => {
    const { transactions } = read<DocumentTransactionEntry>(entry);
    transactions.forEach((transaction) => {
      transaction.forEach((entry) => {
        newConfig = applyConfigTransaction(newConfig, entry);
      });
    });
  });

  return newConfig;
};
