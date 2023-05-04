import React from "react";
import { useClient } from "../client";
import { DocumentId, FolderId, FieldId } from "@storyflow/shared/types";
import type { SyntaxTreeRecord } from "@storyflow/fields-core/types";
import { DEFAULT_FIELDS } from "@storyflow/fields-core/default-fields";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/fields-core/constants";
import { createTemplateFieldId } from "@storyflow/fields-core/ids";
import { createTransaction } from "@storyflow/collab/utils";
import { DocumentAddTransactionEntry } from "operations/actions";
import { usePush } from "../collab/CollabContext";
import {
  useDocumentIdGenerator,
  useTemplateIdGenerator,
} from "../id-generator";
import { usePanel, useRoute } from "../layout/panel-router/Routes";
import { getDefaultValuesFromTemplateAsync } from "./template-fields";

export const useAddDocument = (
  options: { type?: "template" | "document"; navigate?: boolean } = {}
) => {
  const generateDocumentId = useDocumentIdGenerator();
  const generateTemplateId = useTemplateIdGenerator();
  const [, navigate] = usePanel();
  const route = useRoute();
  const client = useClient();

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
            client,
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
      if (options.navigate) {
        navigate(`${route}/${options.type === "template" ? "t" : "d"}${id}`, {
          navigate: true,
        });
      }
      return id;
    },
    [push, options.navigate, route, navigate, client, generateDocumentId]
  );

  return addDocument;
};
