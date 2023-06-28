import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";
import {
  getDocumentId,
  computeFieldId,
  getIdFromString,
  getParentDocumentId,
} from "@storyflow/cms/ids";
import { tokens } from "@storyflow/cms/tokens";
import { SyntaxTreeRecord } from "@storyflow/cms/types";
import {
  FieldId,
  LibraryConfigRecord,
  DocumentId,
  ValueArray,
  ClientSyntaxTree,
  Config,
  PropConfig,
  NestedElement,
  PropConfigRecord,
} from "@storyflow/shared/types";
import { fetchDocumentSync } from "../documents";
import { store } from "../state/state";
import { extendPath } from "../utils/extendPath";
import { ValueRecord } from "./FieldPage";
import { calculateFn } from "./default/calculateFn";
import { getChildrenDocuments } from "@storyflow/cms/graph";
import { getPropIds } from "../utils/flattenProps";
import { getConfigFromType } from "../AppConfigContext";

const getInitializedProp = (
  fieldId: FieldId,
  record: SyntaxTreeRecord,
  {
    isNative,
    documentId,
    contextDocumentId,
  }: {
    isNative: boolean;
    documentId: DocumentId;
    contextDocumentId: DocumentId;
  }
) => {
  const prop = store.use<ValueArray | ClientSyntaxTree>(fieldId);

  if (!prop.initialized()) {
    let initialValue = record[fieldId];

    // if it has a value even if it is not native, then the external value is probably
    // cached in this document already and we can continue with that record

    if (!initialValue && !isNative) {
      fetchDocumentSync(documentId).then((doc) => {
        if (!doc) return undefined;
        const value = doc.record[fieldId];
        if (!value) return undefined;
        prop.set(() => {
          return calculateFn(value, {
            record: doc.record,
            contextDocumentId,
          });
        });
      });
      if (!prop.initialized()) {
        // if not sync, we need to set it to empty array
        prop.set(() => []);
      }
    } else {
      prop.set(() =>
        calculateFn(initialValue ?? DEFAULT_SYNTAX_TREE, {
          record,
          contextDocumentId,
        })
      );
    }
  }

  return prop.value!;
};

export const getRecordSnapshot = <T>(
  entry: FieldId,
  map: (value: ValueArray | ClientSyntaxTree, fieldId: FieldId) => T,
  {
    record = {},
    configs,
    transform,
  }: {
    record?: SyntaxTreeRecord;
    configs: LibraryConfigRecord;
    transform?: (
      el: NestedElement,
      props: Record<string, T>,
      config: PropConfigRecord
    ) => any;
  }
) => {
  const documentId = getDocumentId(entry) as DocumentId;

  const recursivelyGetRecordFromStream = (
    fieldId: FieldId,
    propDocumentId: DocumentId
  ) => {
    // calculating prop and its children
    const value = getInitializedProp(fieldId, record, {
      isNative: propDocumentId === documentId,
      documentId: propDocumentId,
      contextDocumentId: documentId,
    });

    if (transform) {
      return map(getChildren(value), fieldId);
    }

    // tail-call optimization?
    const result = map(value, fieldId);
    getChildren(value);
    return result;
  };

  function getChildren(value: ValueArray | ClientSyntaxTree) {
    let array: ValueArray = [];
    if (!Array.isArray(value)) {
      array = getChildrenDocuments(value, "element");
    } else {
      array = value;
    }

    return array.map((element): ValueArray[number] => {
      if (Array.isArray(element)) {
        return getChildren(element);
      } else if (tokens.isNestedElement(element)) {
        const config = getConfigFromType(element.element, configs)?.props ?? {};
        const propKeys = getPropIds(config, element.id);
        const propDocumentId = getParentDocumentId(element.id);
        const props = Object.fromEntries(
          propKeys.map((id) => {
            return [id, recursivelyGetRecordFromStream(id, propDocumentId)];
          })
        );
        if (transform) {
          return transform(element, props, config);
        }
        return element;
      }
      return element;
    });
  }

  return recursivelyGetRecordFromStream(entry, documentId);
};
