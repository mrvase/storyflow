import { DocumentId, FieldId, TemplateFieldId } from "@storyflow/backend/types";

export const addImport = createEvent<{
  id: FieldId;
  templateId?: TemplateFieldId;
  imports: string[];
}>("add-import");
export const addDocumentImport = createEvent<{
  documentId: DocumentId;
  templateId: DocumentId | undefined;
}>("add-document-import");
export const addLayoutElement = createEvent<{ name: string; library: string }>(
  "add-layout-element"
);
export const addNestedDocument = createEvent("add-nested-document");
export const addFetcher = createEvent("add-fetcher");

export function createEvent<T = undefined>(
  _name: string,
  target?: HTMLElement | Document | Window
) {
  const name = `__CUSTOM__${_name}`;

  /*
  if (controlSet.has(name)) {
    throw new Error(`Custom event already exists with name: ${_name}`);
  } else {
    controlSet.add(name);
  }
  */

  return {
    dispatch: (...args: T extends undefined ? [] : [options: T]) => {
      (target ?? document).dispatchEvent(
        new CustomEvent(name, {
          detail: args[0],
        })
      );
    },
    subscribe: (callback: (payload: T) => void) => {
      const func = (ev: Event & { detail?: T }) => {
        return callback(ev.detail!);
      };
      (target ?? document).addEventListener(name, func);
      return () => {
        (target ?? document).removeEventListener(name, func);
      };
    },
  };
}
