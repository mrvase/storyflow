import type { FieldId } from "@storyflow/shared/types";
import type { DBDocument } from "@storyflow/cms/types";
import { getRawFieldId } from "@storyflow/cms/ids";
import {
  applyFieldTransaction,
  createDocumentTransformer,
} from "../operations/apply";
import { FieldTransactionEntry } from "../operations/actions";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";
import { splitTransformsAndRoot } from "@storyflow/cms/transform";
import {
  createTokenStream,
  parseTokenStream,
} from "../operations/parse-token-stream";
import { collab } from "../collab/CollabContext";

export const getUpdatedFieldValue = async (
  fieldId: FieldId,
  doc: Pick<DBDocument, "_id" | "versions" | "config" | "record">
) => {
  /**
   * We only want to know what the live value is at this moment, and
   * we do not need to register to changes. This is what getInitializedTimelineAsync
   * allows us to do.
   */
  /**
   * TODO
   * Does not take into account that label might refer to other fields
   * which are not yet initialized. And the value will not be the latest.
   */
  const timeline = await collab.getInitializedTimelineAsync(doc._id, {
    versions: doc.versions,
    transform: createDocumentTransformer(doc),
  });

  const initialValue = doc.record[fieldId] ?? DEFAULT_SYNTAX_TREE;

  const [transforms, root] = splitTransformsAndRoot(initialValue);

  let prev = {
    transforms,
    stream: createTokenStream(root),
  };

  timeline
    .getQueue<FieldTransactionEntry>(getRawFieldId(fieldId))
    .forEach(({ transaction }) => {
      transaction.forEach((entry) => {
        if (entry[0] === fieldId) {
          prev = applyFieldTransaction(prev, entry);
        }
      });
    });

  const isModified = timeline.getStatus().isMutated;

  const tree = parseTokenStream(prev.stream, prev.transforms);

  return {
    tree,
    isModified,
  };
};
