import type { ClientSyntaxTree, ValueArray } from "@storyflow/shared/types";
import type { DBDocument } from "@storyflow/cms/types";
import { useGlobalState } from "../state/state";
import { createTemplateFieldId, isTemplateDocument } from "@storyflow/cms/ids";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";
import React from "react";
import { useCollab } from "../collab/CollabContext";
import { calculateFn } from "../fields/default/calculateFn";
import { BaseTranslationFunction } from "../translation/TranslationContext";
import { getUpdatedFieldValue } from "./getUpdatedFieldValue";

export function getDocumentLabel(
  doc: DBDocument,
  t: BaseTranslationFunction
): string;
export function getDocumentLabel(
  doc: DBDocument | undefined,
  t: BaseTranslationFunction
): string | undefined;
export function getDocumentLabel(
  doc: DBDocument | undefined
): string | undefined;
export function getDocumentLabel(
  doc: DBDocument | undefined,
  t?: BaseTranslationFunction
): string | undefined {
  if (!doc) return t ? t.documents.unnamedDocument() : undefined;

  const isTemplate = isTemplateDocument(doc?._id);
  const label = isTemplate ? "template_label" : "label";

  let defaultLabel = calculateRootFieldFromRecord(
    createTemplateFieldId(doc._id, DEFAULT_FIELDS[label].id),
    doc.record
  )[0] as string | undefined;

  defaultLabel =
    typeof defaultLabel === "string" ? defaultLabel.trim() : undefined;
  const fallback = isTemplate
    ? t?.documents?.unsavedTemplate()
    : t?.documents?.unnamedDocument();
  return defaultLabel ?? fallback;
}

export const useDocumentLabel = <T extends DBDocument | undefined>(
  doc: T
): {
  label: T extends undefined ? undefined : string;
  isModified: boolean;
} => {
  const isTemplate = doc ? isTemplateDocument(doc?._id) : false;
  const label = isTemplate ? "template_label" : "label";

  const defaultLabel = getDocumentLabel(doc);

  const id = doc
    ? createTemplateFieldId(doc._id, DEFAULT_FIELDS[label].id)
    : undefined;

  const [isModified, setIsModified] = React.useState(false);
  const [output, setOutput] = useGlobalState<ValueArray | ClientSyntaxTree>(id);

  const collab = useCollab();

  React.useEffect(() => {
    if (!doc || !id) return;
    getUpdatedFieldValue(id, doc, collab).then(({ tree, isModified }) => {
      setOutput(() =>
        calculateFn(tree, {
          record: doc.record,
          documentId: doc._id,
        })
      );
      setIsModified(isModified);
    });
  }, [doc, collab]);

  if (typeof doc === "undefined") {
    return {
      label: undefined as any,
      isModified,
    };
  }

  if (
    output &&
    Array.isArray(output) &&
    output.length > 0 &&
    typeof output[0] === "string"
  ) {
    return {
      label: output[0].trim() as any,
      isModified,
    };
  }

  return { label: defaultLabel as any, isModified };
};
