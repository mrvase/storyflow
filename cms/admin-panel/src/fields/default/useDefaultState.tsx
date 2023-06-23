import React from "react";
import { useGlobalState } from "../../state/state";
import {
  FieldId,
  ValueArray,
  ClientSyntaxTree,
  RawDocumentId,
  DocumentId,
} from "@storyflow/shared/types";
import type { SyntaxTree, FieldTransform } from "@storyflow/cms/types";
import type { TokenStream } from "../../operations/types";
import { getDocumentId, getRawFieldId } from "@storyflow/cms/ids";
import { useFieldId, useFieldIdUnsafe } from "../FieldIdContext";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import {
  createTokenStream,
  parseTokenStream,
} from "../../operations/parse-token-stream";
import { collab } from "../../collab/CollabContext";
import { useFieldConfig } from "../../documents/document-config";
import { useSingular } from "../../state/useSingular";
import { calculateFn } from "./calculateFn";
import { splitTransformsAndRoot } from "@storyflow/cms/transform";
import { applyFieldTransaction } from "../../operations/apply";
import { createQueueCache } from "../../collab/createQueueCache";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";
import { FieldTransactionEntry } from "../../operations/actions";

export function useDefaultStateCore(id: FieldId) {
  const rootId = useFieldIdUnsafe() ?? id;
  const { record } = useDocumentPageContext();

  const initialValue = record[id] ?? DEFAULT_SYNTAX_TREE;

  const [tree, setTree] = useGlobalState<SyntaxTree>(
    `${id}#tree`,
    () => initialValue
  );

  const [value, setValue] = useGlobalState<ValueArray | ClientSyntaxTree>(
    id,
    () =>
      calculateFn(initialValue, {
        record,
        documentId: getDocumentId(rootId),
      })
  );

  const setState = React.useCallback(
    (stream: TokenStream, transforms: FieldTransform[]) => {
      const tree = parseTokenStream(stream, transforms);
      console.log("TREE!!", tree);
      setTree(() => tree);
      setValue(() =>
        calculateFn(tree, {
          record,
          documentId: getDocumentId(rootId),
        })
      );
    },
    []
  );

  return { initialValue, tree, value, setState };
}

export function useDefaultState(id: FieldId) {
  const rootId = useFieldIdUnsafe() ?? id;

  const { initialValue, tree, value, setState } = useDefaultStateCore(id);

  const target = id;
  const singular = useSingular(id);

  React.useEffect(() => {
    const queue = collab
      .getTimeline(getDocumentId<DocumentId>(rootId))!
      .getQueue<FieldTransactionEntry>(getRawFieldId(rootId));

    const [transforms, root] = splitTransformsAndRoot(initialValue);

    const cache = createQueueCache({
      transforms,
      stream: createTokenStream(root),
    });

    return queue.register(() => {
      singular(() => {
        let update = false;

        const result = cache(queue.forEach, (prev, { transaction }) => {
          transaction.forEach((entry) => {
            if (entry[0] === target) {
              prev = applyFieldTransaction(prev, entry);
              update = true;
            }
          });
          return prev;
        });

        if (update) {
          setState(result.stream, result.transforms);
        }
      });
    });
  }, []);

  const isPrimitive = Array.isArray(value) && value[0] === tree.children[0];

  const transforms = React.useMemo(() => {
    return splitTransformsAndRoot(tree)[0];
  }, [tree]);

  const templateId =
    id === rootId
      ? useFieldConfig(rootId)[0]?.template
      : transforms.find(
          (el): el is FieldTransform<"template"> => el.type === "template"
        )?.data;

  return {
    target,
    initialValue,
    tree,
    value,
    isPrimitive,
    transforms,
    templateId,
  };
}
