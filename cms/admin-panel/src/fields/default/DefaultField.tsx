import React from "react";
import cl from "clsx";
import type { DocumentId, FieldId } from "@storyflow/shared/types";
import { getDocumentId, getRawFieldId } from "@storyflow/fields-core/ids";
import { useFieldId } from "../FieldIdContext";
import { createTokenStream } from "operations/parse-token-stream";
import { usePush } from "../../collab/CollabContext";
import { ContentEditable } from "../../editor/react/ContentEditable";
import Editor from "../Editor/Editor";
import { getPreview } from "./getPreview";
import { Placeholder } from "./Placeholder";
import { PromptButton } from "../prompt/PromptButton";
import { TemplateHeader } from "./TemplateHeader";
import { tools } from "operations/stream-methods";
import { useDefaultState } from "./useDefaultState";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { $getRoot, BLUR_COMMAND, COMMAND_PRIORITY_EDITOR } from "lexical";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import { Overlay } from "../prompt/Overlay";
import { Option } from "../prompt/Option";
import { useMathMode } from "../Editor/useMathMode";
import { Bars2Icon, VariableIcon } from "@heroicons/react/24/outline";
import { FieldTemplateIdContext } from "./FieldTemplateContext";
import {
  FieldTransactionEntry,
  StreamOperation,
  TransformOperation,
} from "operations/actions";
import { SpliceOperation, Transaction } from "@storyflow/collab/types";
import { createTransaction, isSpliceOperation } from "@storyflow/collab/utils";
import { PushFunction } from "@storyflow/collab/Queue";
import { HeadingNode } from "../../editor/react/HeadingNode";
import nodes from "../Editor/decorators/nodes";
import { CreatorCircularImport } from "../Editor/decorators/CreatorNode";
import { LayoutElementCircularImport } from "../Editor/decorators/LayoutElementNode";
import { FolderCircularImport } from "../Editor/decorators/FolderNode";

const isTextInsert = (
  transaction: Transaction<FieldTransactionEntry>
): transaction is [[FieldId, [[number, number, [string]]]]] => {
  if (!isSingleSpliceTransaction(transaction)) return false;
  const op = transaction[0][1][0];
  return (
    Array.isArray(op[2]) &&
    op[2].length === 1 &&
    typeof op[2][0] === "string" &&
    !op[1]
  );
};

const isTextDeletion = (
  transaction: Transaction<FieldTransactionEntry>
): transaction is [[FieldId, [[number, number]]]] => {
  if (!isSingleSpliceTransaction(transaction)) return false;
  const op = transaction[0][1][0];
  return Boolean((!op[2] || !op[2].length) && op[1]);
};

const isSingleSpliceTransaction = (
  value: Transaction<FieldTransactionEntry>
): value is [[FieldId, [SpliceOperation]]] => {
  return (
    value.length === 1 &&
    value[0][1].length === 1 &&
    isSpliceOperation(value[0][1][0])
  );
};

const createObjectKey = (() => {
  const ids = new WeakMap();

  return function createObjectKey(object: object) {
    let key = ids.get(object);
    if (!key) {
      key = Math.random().toString(36).slice(2, 10);
      ids.set(object, key);
    }
    return key;
  };
})();

const isAdjacent = (
  prev: Transaction<FieldTransactionEntry>,
  next: Transaction<FieldTransactionEntry>
): boolean => {
  if (!isSingleSpliceTransaction(prev) || !isSingleSpliceTransaction(next)) {
    return false;
  }

  const prevOp = prev[0][1][0];
  const nextOp = next[0][1][0];

  const prevEndingIndex = prevOp[0] + tools.getLength(prevOp[2] ?? []); // - (prevOp[1] ?? 0);
  const nextStartingIndex = nextOp[0] + (nextOp[1] ?? 0);

  return prevEndingIndex === nextStartingIndex;
};

CreatorCircularImport.DefaultField = DefaultField;
LayoutElementCircularImport.DefaultField = DefaultField;
FolderCircularImport.DefaultField = DefaultField;

const allNodes = [HeadingNode, ...nodes];

export function DefaultField({
  id,
  showPromptButton,
  showTemplateHeader,
}: {
  id: FieldId;
  showPromptButton?: boolean;
  showTemplateHeader?: boolean;
}) {
  const rootId = useFieldId();

  const { target, initialValue, value, isPrimitive, templateId, transforms } =
    useDefaultState(id);

  const initialEditorValue = React.useMemo(
    () => createTokenStream(initialValue),
    [initialValue]
  );

  const preview = getPreview(value);

  const tracker = React.useMemo(() => ({}), []);

  const push = usePush<FieldTransactionEntry>(
    getDocumentId<DocumentId>(rootId),
    getRawFieldId(rootId)
  );

  const hasLocalPush = React.useRef(false);

  const mergePush = React.useCallback(
    (ops: StreamOperation[] | TransformOperation[]) => {
      hasLocalPush.current = true;
      return push((prev) => {
        let result: Transaction<FieldTransactionEntry>[] = [];

        const next: Transaction<FieldTransactionEntry> = [
          [id, ops] as FieldTransactionEntry,
        ];

        if (!prev) {
          result = [next];
        } else {
          result = [prev, next];

          if (isAdjacent(prev, next)) {
            if (
              isTextInsert(prev) &&
              isTextInsert(next) &&
              next[0][1][0][2][0] !== " "
            ) {
              const prevOp = prev[0][1][0];
              const nextOp = next[0][1][0];
              result = [
                createTransaction((t) =>
                  t.target(id).splice({
                    index: prevOp[0],
                    insert: tools.concat(prevOp[2], nextOp[2]),
                  })
                ),
              ];
            } else if (isTextDeletion(prev) && isTextDeletion(next)) {
              const prevOp = prev[0][1][0];
              const nextOp = next[0][1][0];
              result = [
                createTransaction((t) =>
                  t.target(id).splice({
                    index: nextOp[0],
                    remove: prevOp[1] + nextOp[1],
                  })
                ),
              ];
            }
          }
        }

        const latest = result[result.length - 1];

        if (isTextInsert(latest) || isTextDeletion(latest)) {
          return {
            await: latest,
            push: result.slice(0, -1),
          };
        }

        return {
          push: result,
        };
      }, tracker);
    },
    [push]
  );

  return (
    <FieldTemplateIdContext.Provider value={templateId ?? null}>
      {(templateId || showTemplateHeader) && (
        <TemplateHeader
          transforms={transforms}
          id={id}
          isNested={id !== rootId}
        />
      )}
      <Editor
        key={createObjectKey(initialEditorValue)}
        target={target}
        push={mergePush}
        tracker={tracker}
        initialValue={initialEditorValue}
        nodes={allNodes}
      >
        <div className={cl("relative")}>
          <Placeholder />
          <ContentEditable
            className={cl(
              "grow editor outline-none selection:bg-gray-700",
              "text-base leading-6 pb-2.5"
            )}
            // data-value={!isPrimitive ? preview : ""}
          />
          {!isPrimitive && (
            <div className="-ml-9 preview hidden text-gray-400 rounded text-sm pb-2.5">
              <Bars2Icon className="shrink-0 w-4 mt-0.5 h-4 mr-5 opacity-50" />
              {preview || "[Tom]"}
            </div>
          )}
          {showPromptButton && <PromptButton />}
          <PushOnBlurPlugin
            push={push}
            tracker={tracker}
            hasLocalPush={hasLocalPush}
          />
          <OverlayWrapper />
          <BottomSelectionArea />
          <div className="absolute right-0 top-0">
            {transforms.length ? (
              <VariableIcon className="w-4 h-4 my-1 opacity-50" />
            ) : null}
          </div>
        </div>
      </Editor>
    </FieldTemplateIdContext.Provider>
  );
}

function BottomSelectionArea() {
  const editor = useEditorContext();

  return (
    <div
      className="absolute inset-x-0 bottom-0 h-2.5 cursor-text"
      onMouseDown={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        editor.update(() => {
          editor.getRootElement()?.focus();
          $getRoot().selectEnd();
          /*
          if ($isTextBlockNode(node)) {
          } else if (node) {
            const offset =
              root
                .getChildren()
                .findIndex((el) => el.getKey() === node!.getKey()) + 1;
            console.log("HERE", node, offset);
            if (offset < 1) return;
            const selection = $createRangeSelection(
              {
                node: root,
                offset,
                type: "element",
              },
              {
                node: root,
                offset,
                type: "element",
              }
            );
            $setSelection(selection);
          }
          */
        });
      }}
    />
  );
}

function OverlayWrapper() {
  const [mathMode, setMathMode] = useMathMode();

  return (
    <Overlay>
      <div className="p-2.5">
        <div className="font-medium text-gray-400 mb-1 ml-1">Tilstand</div>
        <Option
          value={null}
          onEnter={() => {
            setMathMode((ps) => !ps);
          }}
        >
          {mathMode ? "Deaktiver" : "Aktiver"} listetilstand
        </Option>
      </div>
    </Overlay>
  );
}

function PushOnBlurPlugin({
  push,
  tracker,
  hasLocalPush,
}: {
  push: (
    payload: PushFunction<FieldTransactionEntry>,
    tracker?: object
  ) => void;
  tracker: object;
  hasLocalPush: React.MutableRefObject<boolean>;
}) {
  const editor = useEditorContext();

  const escapePush = React.useCallback(() => {
    push((latest) => {
      return {
        push: latest ? [latest] : [],
      };
    }, tracker);
  }, [push]);

  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          console.log("BLUR PUSH");
          escapePush();
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      )
    );
  }, [editor, escapePush]);

  React.useEffect(() => {
    return () => {
      if (hasLocalPush.current) {
        console.log("CLOSE PUSH");
        escapePush();
      }
    };
  }, [editor, escapePush]);

  return null;
}
