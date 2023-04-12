import React from "react";
import { useGlobalState } from "../../state/state";
import {
  FieldId,
  FieldType,
  SyntaxTree,
  ValueArray,
  TokenStream,
  Transform,
} from "@storyflow/backend/types";
import { getDocumentId, getRawFieldId } from "@storyflow/backend/ids";
import { useFieldId } from "../FieldIdContext";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import { targetTools, ComputationOp } from "shared/operations";
import { createTokenStream, parseTokenStream } from "shared/parse-token-stream";
import { useClient } from "../../client";
import { useDocumentCollab } from "../../documents/collab/DocumentCollabContext";
import { useFieldConfig } from "../../documents/collab/hooks";
import { useSingular } from "../../state/useSingular";
import { calculateFn } from "./calculateFn";
import { getConfig } from "shared/initialValues";
import { getNextState } from "shared/computation-tools";
import { createQueueCache } from "../../state/collaboration";
import { getDefaultField } from "@storyflow/backend/fields";

export function useDefaultState(id: FieldId) {
  const rootId = useFieldId();
  const { record } = useDocumentPageContext();
  const client = useClient();

  let fieldType: FieldType = "default";
  let transform: Transform | undefined = undefined;

  if (id === rootId) {
    let [config] = useFieldConfig(rootId);
    if (!config) {
      // dragged component
      const defaultFieldConfig = getDefaultField(rootId);
      config = {
        id: rootId,
        type: defaultFieldConfig?.type ?? "default",
        label: defaultFieldConfig?.label ?? "",
      };
    }
    fieldType = config.type ?? "default";

    transform = React.useMemo(
      () => config!.transform ?? getConfig(fieldType).transform,
      [config]
    );
  }

  const initialValue = React.useMemo(
    () => record[id] ?? getConfig(fieldType).defaultValue,
    []
  );

  const [tree, setTree] = useGlobalState<SyntaxTree>(
    `${id}#tree`,
    () => initialValue
  );

  const [value, setValue] = useGlobalState<ValueArray>(id, () =>
    calculateFn(rootId, initialValue, { record, client })
  );

  const setState = React.useCallback(
    (func: () => TokenStream, updatedTransform?: Transform) => {
      const tree = parseTokenStream(func(), updatedTransform ?? transform);
      setTree(() => tree);
      setValue(() => calculateFn(rootId, tree, { client, record }));
    },
    [transform]
  );

  const setTransform = React.useCallback(
    (transform: Transform | undefined) => {
      setState(() => createTokenStream(tree!), transform);
    },
    [setState, tree]
  );

  const target = targetTools.stringify({
    field: fieldType,
    operation: "computation",
    location: id === rootId ? "" : id,
  });

  const collab = useDocumentCollab();
  const actions = React.useMemo(
    () =>
      collab.boundMutate<ComputationOp>(
        getDocumentId(rootId),
        getRawFieldId(rootId)
      ),
    [collab]
  );

  const singular = useSingular(`${rootId}${target}`);

  React.useEffect(() => {
    const cache = createQueueCache(createTokenStream(initialValue));

    return actions.register(({ forEach }) => {
      singular(() => {
        let update = false;

        const result = cache(forEach, (prev, { operation }) => {
          if (operation.target === target) {
            prev = getNextState(prev, operation);
            update = true;
          }
          return prev;
        });

        if (update) {
          setState(() => result);
        }
      });
    });
  }, []);

  const isPrimitive = value[0] === tree.children[0];

  return { target, initialValue, tree, value, setTransform, isPrimitive };
}
