import React from "react";
import { useGlobalState } from "../../state/state";
import {
  FieldId,
  ValueArray,
  ClientSyntaxTree,
  RawDocumentId,
  DocumentId,
} from "@storyflow/shared/types";
import type { SyntaxTree, FieldTransform } from "@storyflow/fields-core/types";
import type { TokenStream } from "operations/types";
import { getDocumentId, getRawFieldId } from "@storyflow/fields-core/ids";
import { useFieldId } from "../FieldIdContext";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import {
  createTokenStream,
  parseTokenStream,
} from "operations/parse-token-stream";
import { useClient } from "../../client";
import { useCollab } from "../../collab/CollabContext";
import { useFieldConfig } from "../../documents/hooks";
import { useSingular } from "../../state/useSingular";
import { calculateFn } from "./calculateFn";
import { splitTransformsAndRoot } from "@storyflow/fields-core/transform";
import { applyFieldTransaction } from "operations/apply";
import { createQueueCache } from "../../collab/createQueueCache";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/fields-core/constants";
import { FieldTransactionEntry } from "operations/actions_new";

export function useDefaultStateCore(id: FieldId) {
  const rootId = useFieldId();
  const { record } = useDocumentPageContext();
  const client = useClient();

  /*
  if (id === rootId) {
    let [config] = useFieldConfig(rootId);
    if (!config) {
      // dragged component
      const defaultFieldConfig = getDefaultField(rootId);
      config = {
        id: rootId,
        ui: defaultFieldConfig?.ui,
        type2: defaultFieldConfig?.type2,
        label: defaultFieldConfig?.label ?? "",
      };
    }
  }
  */

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
        client,
        documentId: getDocumentId(rootId),
      })
  );

  const setState = React.useCallback(
    (stream: TokenStream, transforms: FieldTransform[]) => {
      const tree = parseTokenStream(stream, transforms);
      setTree(() => tree);
      setValue(() =>
        calculateFn(tree, {
          client,
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
  const rootId = useFieldId();

  const { initialValue, tree, value, setState } = useDefaultStateCore(id);

  const collab = useCollab();

  const target = id;
  const singular = useSingular(id);

  React.useEffect(() => {
    // we assume it has been initialized in a useLayoutEffect in the component or its parent.
    // we do not initialize it here, because this hook is also for nested fields that use their
    // parent's queue.
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
          transaction.map((entry) => {
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
  }, [collab]);

  const isPrimitive = Array.isArray(value) && value[0] === tree.children[0];

  const transforms = React.useMemo(() => {
    return splitTransformsAndRoot(tree)[0];
  }, [tree]);

  const templateId =
    id === rootId
      ? useFieldConfig(rootId)[0]?.template
      : (transforms.find((el) => el.type === "template")?.data as
          | RawDocumentId
          | undefined);

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
