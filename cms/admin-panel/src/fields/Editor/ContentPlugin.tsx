import * as React from "react";
import { useEditorContext } from "../../editor/react/EditorProvider";
import useLayoutEffect from "../../editor/react/useLayoutEffect";
import { registerPlainText } from "../../editor/registerPlainText";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import {
  addContext,
  addDocumentImport,
  addImport,
  addLayoutElement,
  addNestedDocument,
  addNestedFolder,
} from "../../custom-events";
import { DocumentId, TokenStream } from "@storyflow/backend/types";
import { useClientConfig } from "../../client-config";
import { useFieldConfig } from "../../documents/collab/hooks";
import { useFieldId } from "../FieldIdContext";
import { createComponent } from "./createComponent";
import { replaceWithComputation } from "./insertComputation";
import { useDocumentIdGenerator } from "../../id-generator";
import { getDocumentId } from "@storyflow/backend/ids";
import { useIsFocused } from "../../editor/react/useIsFocused";

export function ContentPlugin() {
  const editor = useEditorContext();

  const { libraries } = useClientConfig();

  useEditorEvents();

  useLayoutEffect(() => {
    return registerPlainText(editor, libraries, { allowLineBreaks: true });
  }, [editor, libraries]);

  return null;
}

function useEditorEvents() {
  const editor = useEditorContext();
  const isFocused = useIsFocused();

  const { libraries } = useClientConfig();

  const fieldId = useFieldId();

  const documentId = getDocumentId(fieldId) as DocumentId;

  const [fieldConfig, setFieldConfig] = useFieldConfig(fieldId);

  const generateDocumentId = useDocumentIdGenerator();

  React.useEffect(() => {
    if (isFocused) {
      return mergeRegister(
        addImport.subscribe(async ({ id: externalId, templateId, imports }) => {
          if (fieldId && imports.includes(fieldId)) {
            console.error("Tried to add itself");
            return;
          }
          const insert: TokenStream = [
            {
              id: generateDocumentId(documentId),
              field: externalId,
              ...(templateId && { select: templateId }),
              inline: true,
            },
          ];

          replaceWithComputation(editor, insert, libraries);
        }),

        addContext.subscribe(async (ctx) => {
          const insert: TokenStream = [
            {
              ctx,
            },
          ];

          replaceWithComputation(editor, insert, libraries);
        }),

        addNestedFolder.subscribe(async ({ folderId, templateId }) => {
          const insert = [
            {
              id: generateDocumentId(documentId),
              folder: folderId,
            },
          ];

          replaceWithComputation(editor, insert, libraries);

          if (templateId && !fieldConfig?.template) {
            setFieldConfig("template", templateId);
          }
        }),

        addDocumentImport.subscribe(async ({ documentId, templateId }) => {
          const insert = [
            {
              id: documentId,
            },
          ];

          replaceWithComputation(editor, insert, libraries);
          /*
          editor.update(() => {
            addBlockElement(insert);
          });
          */
          if (templateId && !fieldConfig?.template) {
            setFieldConfig("template", templateId);
          }
        }),

        addLayoutElement.subscribe(async ({ library, name }) => {
          const component = createComponent(
            generateDocumentId(documentId),
            name,
            { library, libraries }
          );

          const insert: TokenStream = [component];

          replaceWithComputation(editor, insert, libraries);

          /*
          if (isInlineElement(libraries, component)) {
            insertComputation(editor, computation, libraries);
          } else {
            editor.update(() => {
              addBlockElement(computation);
            });
          }
          */
        }),

        addNestedDocument.subscribe(() => {
          const insert: TokenStream = [{ id: generateDocumentId(documentId) }];
          replaceWithComputation(editor, insert, libraries);
          /*
          editor.update(() => {
            addBlockElement([{ id: generateDocumentId(documentId) }]);
          });
          */
        })
      );
    }
  }, [editor, libraries, isFocused, fieldId, generateDocumentId]);
}
