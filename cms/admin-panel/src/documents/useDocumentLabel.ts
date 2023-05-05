import type { ValueArray } from "@storyflow/shared/types";
import type { DBDocument } from "@storyflow/cms/types";
import { useGlobalState } from "../state/state";
import { createTemplateFieldId } from "@storyflow/cms/ids";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";

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
): T extends undefined ? undefined : string => {
  const defaultLabel = getDocumentLabel(doc);

  const [output] = useGlobalState<ValueArray>(
    doc ? createTemplateFieldId(doc._id, DEFAULT_FIELDS.label.id) : undefined
  );

  if (typeof doc === "undefined") {
    return undefined as any;
  }

  if (doc?.label) {
    return (doc.label as any).trim() || fallbackLabel;
  }

  if (output && output.length > 0) {
    return (
      (typeof output[0] === "string" ? output[0] : "")?.trim() ||
      (fallbackLabel as any)
    );
  }

  return defaultLabel?.trim() || (fallbackLabel as any);
};
