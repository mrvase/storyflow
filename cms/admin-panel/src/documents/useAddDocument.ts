import React from "react";
import { DocumentId, FolderId, FieldId } from "@storyflow/shared/types";
import type { SyntaxTreeRecord } from "@storyflow/cms/types";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";
import { createTemplateFieldId } from "@storyflow/cms/ids";
import { createTransaction } from "@storyflow/collab/utils";
import { DocumentAddTransactionEntry } from "../operations/actions";
import { collab, usePush } from "../collab/CollabContext";
import {
  useDocumentIdGenerator,
  useTemplateIdGenerator,
} from "../id-generator";
import {
  getDefaultValuesFromTemplateAsync,
  pushDefaultValues,
} from "./template-fields";
import { createDocumentTransformer } from "../operations/apply";
import { useNavigate, useRoute } from "@nanokit/router";

export const useAddDocument = (
  options: { type?: "template" | "document"; navigate?: boolean } = {}
) => {
  const generateDocumentId = useDocumentIdGenerator();
  const generateTemplateId = useTemplateIdGenerator();
  const navigate = useNavigate();
  const route = useRoute();

  const push = usePush<DocumentAddTransactionEntry>("documents");

  const addDocument = React.useCallback(
    async (data: {
      folder: FolderId;
      template?: DocumentId;
      createRecord?: (id: DocumentId) => SyntaxTreeRecord;
    }) => {
      const id =
        options.type === "template"
          ? generateTemplateId()
          : generateDocumentId();
      push(
        createTransaction((t) =>
          t.target(data.folder).toggle({ name: "add", value: id })
        )
      );

      const record = data.template
        ? await getDefaultValuesFromTemplateAsync(id, data.template, {
            generateDocumentId,
          })
        : {};

      if (data.createRecord) {
        const createdRecord = data.createRecord(id);
        Object.entries(createdRecord).forEach(([key, value]) => {
          record[key as FieldId] = value;
        });
      }

      record[createTemplateFieldId(id, DEFAULT_FIELDS.creation_date.id)] = {
        ...DEFAULT_SYNTAX_TREE,
        children: [new Date()],
      };

      // TODO: Push record
      const timeline = collab.initializeTimeline(id, {
        versions: { config: [0] },
        transform: createDocumentTransformer({
          config: [],
          record: {},
        }),
      });

      pushDefaultValues(timeline, { id, record });

      if (options.navigate) {
        navigate(
          `${route.accumulated}/${
            options.type === "template" ? "t" : "d"
          }/${parseInt(id, 16).toString(16)}`
        );
      }
      return id;
    },
    [push, options.navigate, route, navigate, generateDocumentId]
  );

  return addDocument;
};
