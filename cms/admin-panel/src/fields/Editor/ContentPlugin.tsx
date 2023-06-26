import * as React from "react";
import { useEditorContext } from "../../editor/react/EditorProvider";
import useLayoutEffect from "../../editor/react/useLayoutEffect";
import { registerPlainText } from "../../editor/registerPlainText";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import {
  addContext,
  addDocumentImport,
  addFile,
  addImport,
  addLayoutElement,
  addNestedDocument,
  addNestedFolder,
} from "../../custom-events";
import type { DocumentId } from "@storyflow/shared/types";
import type { TokenStream } from "../../operations/types";
import { useAppConfig } from "../../AppConfigContext";
import { useFieldConfig } from "../../documents/document-config";
import { useFieldId } from "../FieldIdContext";
import { createComponent } from "./createComponent";
import { replaceWithComputation } from "./insertComputation";
import { useDocumentIdGenerator } from "../../id-generator";
import { getDocumentId } from "@storyflow/cms/ids";
import { useIsFocused } from "../../editor/react/useIsFocused";

export function ContentPlugin() {
  const editor = useEditorContext();

  useEditorEvents();

  useLayoutEffect(() => {
    return registerPlainText(editor);
  }, [editor]);

  return null;
}

function useEditorEvents() {
  const editor = useEditorContext();
  const isFocused = useIsFocused();

  const { configs } = useAppConfig();

  const fieldId = useFieldId();

  const documentId = getDocumentId(fieldId) as DocumentId;

  const [fieldConfig, setFieldConfig] = useFieldConfig(fieldId);

  const generateDocumentId = useDocumentIdGenerator();

  React.useEffect(() => {
    if (!isFocused) return;
    return mergeRegister(
      addFile.subscribe(async (src) => {
        const insert = [
          {
            src,
          },
        ];

        replaceWithComputation(editor, insert, configs);
      }),

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

        replaceWithComputation(editor, insert, configs);
      }),

      addContext.subscribe(async (ctx) => {
        const insert: TokenStream = [
          {
            ctx,
          },
        ];

        replaceWithComputation(editor, insert, configs);
      }),

      addNestedFolder.subscribe(async ({ folderId, templateId }) => {
        const insert = [
          {
            id: generateDocumentId(documentId),
            folder: folderId,
          },
        ];

        replaceWithComputation(editor, insert, configs);

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

        replaceWithComputation(editor, insert, configs);
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
          { library, configs }
        );

        const insert: TokenStream = [component];

        replaceWithComputation(editor, insert, configs);

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
        replaceWithComputation(editor, insert, configs);
        /*
          editor.update(() => {
            addBlockElement([{ id: generateDocumentId(documentId) }]);
          });
          */
      })
    );
  }, [editor, configs, isFocused, fieldId, generateDocumentId]);
}
