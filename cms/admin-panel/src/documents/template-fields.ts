import type {
  DocumentId,
  FieldId,
  NestedDocumentId,
} from "@storyflow/shared/types";
import type {
  SyntaxTreeRecord,
  FieldConfig,
  SyntaxTree,
} from "@storyflow/cms/types";
import type { DocumentConfig } from "@storyflow/cms/types";
import {
  createTemplateFieldId,
  getDocumentId,
  getRawFieldId,
} from "@storyflow/cms/ids";
import { fetchDocument } from "./index";
import { splitTransformsAndRoot } from "@storyflow/cms/transform";
import { Timeline } from "@storyflow/collab/Timeline";
import { createTransaction } from "@storyflow/collab/utils";
import { FieldTransactionEntry } from "../operations/actions";
import { createTokenStream } from "../operations/parse-token-stream";
import { copyRecord } from "@storyflow/cms/copy-record-async";

export const getDefaultValuesFromTemplateAsync = async (
  newDocumentId: DocumentId,
  templateId: DocumentId,
  options: {
    generateDocumentId: {
      (): DocumentId;
      (parent: DocumentId): NestedDocumentId;
    };
  }
) => {
  const doc = await fetchDocument(templateId);

  if (doc) {
    return await copyRecord(doc.record, {
      oldDocumentId: doc._id,
      newDocumentId,
      generateNestedDocumentId: async () =>
        options.generateDocumentId(newDocumentId),
      generateTemplateFieldId: (key) =>
        createTemplateFieldId(newDocumentId, key),
      excludeSpecialTemplateFields: true,
    });
  }

  return {};
};

export const getTemplateFieldsAsync = async (template: DocumentConfig) => {
  const templates = new Set();

  const getFields = async (
    template: DocumentConfig
  ): Promise<FieldConfig[]> => {
    return await Promise.all(
      template.map(async (el) => {
        if (Array.isArray(el)) {
          return el;
        } else if ("id" in el) {
          return [el];
        } else if ("template" in el && !templates.has(el.template)) {
          templates.add(el.template);
          const doc = await fetchDocument(el.template);
          if (!doc) return [];
          return await getFields(doc.config);
        }
        return [];
      })
    ).then((el) => el.flat(1));
  };

  return await getFields(template);
};

export const pushDefaultValues = (
  timeline: Timeline,
  data: {
    id: DocumentId;
    record: SyntaxTreeRecord;
  }
) => {
  Object.entries(data.record).forEach((entry) => {
    const [fieldId, tree] = entry as [FieldId, SyntaxTree];
    /* only care about native fields */
    if (getDocumentId(fieldId) !== data.id) return;
    /*
    Continue only if it does not exist already
    (that is, if not deleted and now added without a save in between)
    */
    // if (versions && getRawFieldId(fieldId) in versions) return;
    const [transforms, root] = splitTransformsAndRoot(tree);
    const transformOperations = transforms.map((transform) => {
      return { name: transform.type, value: transform.data ?? true };
    });
    const stream = createTokenStream(root);
    const streamOperation = stream.length
      ? { index: 0, insert: createTokenStream(root) }
      : undefined;
    if (transformOperations.length > 0 || streamOperation) {
      /*
      TODO: Overvejelse: Jeg kan godt tilføje og slette og tilføje.
      Har betydning ift. fx url, hvor default children pushes igen.
      Skal muligvis lave en mulighed for, at splice action overskriver alt.
      I så fald kan jeg tjekke, om den har været initialized.
      Hvis ikke, så starter jeg den på version = 0 og pusher med det samme.
      Da det sker sync, ved jeg, at det push registreres som om,
      at det ikke har set andre actions endnu.

      Men hvad sker der, når den kører gennem transform?
      */

      timeline.getQueue<FieldTransactionEntry>(getRawFieldId(fieldId)).push(
        createTransaction((t) =>
          t
            .target(fieldId)
            .toggle(...transformOperations)
            .splice(streamOperation)
        )
      );
    }
  });
};
