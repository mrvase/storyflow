import { TemplateDocument, Value } from "@storyflow/backend/types";
import { useGlobalState } from "../state/state";
import { computeFieldId } from "@storyflow/backend/ids";
import { FIELDS } from "@storyflow/backend/fields";

export const fallbackLabel = "[Titel]";

export const getDocumentLabel = (doc: TemplateDocument | undefined) => {
  if (!doc) return undefined;
  /* TODO should be calculated */
  const defaultLabelValue =
    doc.record[computeFieldId(doc._id, FIELDS.label.id)]?.[0];
  const defaultLabel =
    typeof defaultLabelValue === "string" ? defaultLabelValue : null;
  const creationDateString = doc.record[
    computeFieldId(doc._id, FIELDS.creation_date.id)
  ]?.[0] as string | undefined;
  const creationDate = new Date(creationDateString ?? 0);
  return (
    defaultLabel ??
    `Ny (${new Intl.DateTimeFormat("da-DK", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(creationDate)})`
  );
};

export const useDocumentLabel = <T extends TemplateDocument | undefined>(
  doc: T
): T extends undefined ? undefined : string => {
  const defaultLabel = getDocumentLabel(doc);

  const [output] = useGlobalState<Value[]>(
    doc ? computeFieldId(doc._id, FIELDS.label.id) : undefined
  );

  if (typeof doc === "undefined") {
    return undefined as any;
  }

  if (doc?.label) {
    return doc.label as any;
  }

  if (output && output.length > 0) {
    return typeof output[0] === "string" ? output[0] : (fallbackLabel as any);
  }

  return defaultLabel ?? (fallbackLabel as any);
};
