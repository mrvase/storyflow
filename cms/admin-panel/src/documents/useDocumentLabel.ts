import type { ClientSyntaxTree, ValueArray } from "@storyflow/shared/types";
import type { DBDocument } from "@storyflow/cms/types";
import { useGlobalState } from "../state/state";
import { createTemplateFieldId, getRawFieldId } from "@storyflow/cms/ids";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";
import React from "react";
import { useCollab } from "../collab/CollabContext";
import {
  applyFieldTransaction,
  createDocumentTransformer,
} from "../operations/apply";
import { FieldTransactionEntry } from "../operations/actions";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";
import { splitTransformsAndRoot } from "@storyflow/cms/transform";
import { useClient } from "../client";
import { calculateFn } from "../fields/default/calculateFn";
import {
  createTokenStream,
  parseTokenStream,
} from "../operations/parse-token-stream";

export const fallbackLabel = "[Ingen titel]";

export const getDocumentLabel = (doc: DBDocument | undefined) => {
  if (!doc) return undefined;
  /* TODO should be calculated */
  const defaultLabelValue = calculateRootFieldFromRecord(
    createTemplateFieldId(doc._id, DEFAULT_FIELDS.label.id),
    doc.record
  )[0] as string | undefined;
  const defaultLabel =
    typeof defaultLabelValue === "string" ? defaultLabelValue.trim() : null;
  const creationDateString = calculateRootFieldFromRecord(
    createTemplateFieldId(doc._id, DEFAULT_FIELDS.creation_date.id),
    doc.record
  )[0] as string | undefined;
  const creationDate = new Date(creationDateString ?? 0);
  return (
    defaultLabel ??
    `Ny (${new Intl.DateTimeFormat("da-DK", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(creationDate)})`
  );
};

export const useDocumentLabel = <T extends DBDocument | undefined>(
  doc: T
): {
  label: T extends undefined ? undefined : string;
  isModified: boolean;
} => {
  const defaultLabel = getDocumentLabel(doc);

  const id = doc
    ? createTemplateFieldId(doc._id, DEFAULT_FIELDS.label.id)
    : undefined;

  const client = useClient();
  const initialValue =
    id && doc ? doc.record[id] ?? DEFAULT_SYNTAX_TREE : undefined;

  const [isModified, setIsModified] = React.useState(false);
  const [output, setOutput] = useGlobalState<ValueArray | ClientSyntaxTree>(id);

  const collab = useCollab();

  React.useEffect(() => {
    if (!doc || !id || !initialValue) return;
    let mounted = true;
    console.log("UPDATING HERE ON LABEL", parseInt(doc._id, 16).toString(16));
    (async () => {
      /**
       * We only want to know what the live value is at this moment, and
       * we do not need to register to changes. This is what getInitializedTimelineAsync
       * allows us to do.
       */
      const timeline = await collab.getInitializedTimelineAsync(doc._id, {
        versions: doc.versions,
        transform: createDocumentTransformer(doc),
      });

      if (mounted) {
        const [transforms, root] = splitTransformsAndRoot(initialValue);

        let prev = {
          transforms,
          stream: createTokenStream(root),
        };

        timeline
          .getQueue<FieldTransactionEntry>(getRawFieldId(id))
          .forEach(({ transaction }) => {
            transaction.forEach((entry) => {
              if (entry[0] === id) {
                prev = applyFieldTransaction(prev, entry);
              }
            });
          });

        const isModified = timeline.getStatus().isMutated;

        const tree = parseTokenStream(prev.stream, prev.transforms);
        setOutput(() =>
          calculateFn(tree, {
            client,
            record: doc.record,
            documentId: doc._id,
          })
        );

        setIsModified(isModified);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [doc, collab, client]);

  if (typeof doc === "undefined") {
    return {
      label: undefined as any,
      isModified,
    };
  }

  if (doc?.label) {
    return {
      label: (doc.label as any).trim() || fallbackLabel,
      isModified,
    };
  }

  if (output && Array.isArray(output) && output.length > 0) {
    return {
      label:
        (typeof output[0] === "string" ? output[0] : "")?.trim() ||
        (fallbackLabel as any),
      isModified,
    };
  }

  return { label: defaultLabel?.trim() || (fallbackLabel as any), isModified };
};
