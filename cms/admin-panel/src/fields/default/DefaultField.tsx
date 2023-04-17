import React from "react";
import cl from "clsx";
import { FieldId, TokenStream } from "@storyflow/backend/types";
import { getDocumentId, getRawFieldId } from "@storyflow/backend/ids";
import { useFieldId } from "../FieldIdContext";
import { createTokenStream } from "shared/parse-token-stream";
import { useDocumentCollab } from "../../documents/collab/DocumentCollabContext";
import { useFieldConfig } from "../../documents/collab/hooks";
import { ContentEditable } from "../../editor/react/ContentEditable";
import Editor from "../Editor/Editor";
import { getPreview } from "./getPreview";
import { Placeholder } from "./Placeholder";
import { PromptButton } from "../prompt/PromptButton";
import { TemplateHeader } from "./TemplateHeader";
import { tools } from "shared/editor-tools";
import { useDefaultState } from "./useDefaultState";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { $getRoot, BLUR_COMMAND, COMMAND_PRIORITY_EDITOR } from "lexical";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import { Overlay } from "../prompt/Overlay";
import { Option } from "../prompt/Option";
import { useMathMode } from "../Editor/useMathMode";
import { Bars2Icon } from "@heroicons/react/24/outline";
import {
  FieldOperation,
  StreamAction,
  isSpliceAction,
} from "shared/operations";
import { splitTransformsAndRoot } from "@storyflow/backend/transform";

type TextOps = [{ index: number; insert: [string]; remove?: 0 }];

const isTextInsert = (ops: FieldOperation[1]): ops is TextOps => {
  return (
    ops.length === 1 &&
    isSpliceAction(ops[0]) &&
    Array.isArray(ops[0].insert) &&
    ops[0].insert.length === 1 &&
    !ops[0].remove &&
    typeof ops[0].insert[0] === "string"
  );
};

const isAdjacent = (
  prev: FieldOperation[1],
  next: FieldOperation[1]
): boolean => {
  if (
    prev.length !== 1 ||
    next.length !== 1 ||
    !isSpliceAction(prev[0]) ||
    !isSpliceAction(next[0])
  ) {
    return false;
  }
  const prevEndingIndex =
    prev[0].index +
    tools.getLength(prev[0].insert ?? []) -
    (prev[0].remove ?? 0);
  const nextStartingIndex = next[0].index + (next[0].remove ?? 0);
  return prevEndingIndex === nextStartingIndex;
};

export function DefaultField({
  id,
  showPromptButton,
}: {
  id: FieldId;
  showPromptButton?: boolean;
}) {
  const rootId = useFieldId();
  const [config] = useFieldConfig(rootId);

  const { target, initialValue, value, isPrimitive, tree } =
    useDefaultState(id);

  console.log("TREE", tree);

  const transforms = React.useMemo(() => {
    return splitTransformsAndRoot(tree)[0];
  }, [tree]);

  const initialEditorValue = createTokenStream(initialValue);

  const preview = getPreview(value);

  const collab = useDocumentCollab();
  const actions = React.useMemo(
    () =>
      collab.boundMutate<FieldOperation>(
        getDocumentId(rootId),
        getRawFieldId(rootId)
      ),
    [collab]
  );

  const push = React.useCallback(
    (
      payload:
        | FieldOperation[1]
        | ((
            prev: FieldOperation[1] | undefined,
            noop: FieldOperation[1]
          ) => FieldOperation[1][])
    ) => {
      return actions.mergeablePush((_prev, noop) => {
        const result = [];
        let prev = _prev;
        if (_prev?.[0] !== target) {
          if (prev === noop) {
            prev = noop;
          } else {
            prev = undefined;
            result.push(prev);
          }
        }
        const newOps =
          typeof payload === "function"
            ? payload(prev?.[1], noop[1])
            : [payload];
        return newOps.map((ops) => (ops === noop[1] ? noop : [target, ops]));
      });
    },
    [actions, target]
  );

  const hasLocalPush = React.useRef(false);

  const pushWithBatching = React.useCallback(
    (next: FieldOperation[1]) => {
      hasLocalPush.current = true;
      return push((prev, noop) => {
        let result: FieldOperation[1][] = [];
        if (!prev || prev === noop) {
          result = [next];
        } else {
          result = [prev, next];
          if (
            isSpliceAction(prev[0]) &&
            isSpliceAction(next[0]) &&
            isAdjacent(prev, next) &&
            (isTextInsert(prev) || !isTextInsert(next)) &&
            !(isTextInsert(next) && next[0].insert[0] === " ")
          ) {
            let insert: TokenStream = [];
            let remove = 0;
            let index = prev[0].index;

            // if prev has insert and next has remove, remove from insert first
            if ((prev[0].insert ?? []).length > 0 && next[0].remove) {
              const prevInsertLength = tools.getLength(prev[0].insert!);
              if (next[0].remove > prevInsertLength) {
                const diff = next[0].remove - prevInsertLength;
                insert = next[0].insert ?? [];
                remove = (prev[0].remove ?? 0) + diff;
                index = index - diff; // or just next[0].index ??
              } else {
                const prevInsert = tools.slice(
                  prev[0].insert!,
                  0,
                  -1 * next[0].remove
                );
                insert = tools.concat(prevInsert, next[0].insert ?? []);
                remove = 0;
              }
            } else {
              insert = tools.concat(prev[0].insert ?? [], next[0].insert ?? []);
              remove = (prev[0].remove ?? 0) + (next[0].remove ?? 0);
            }

            const merged: StreamAction[] = [
              {
                index,
              },
            ];
            if (insert.length) merged[0].insert = insert;
            if (remove) merged[0].remove = remove;
            result = [merged];
          }
        }
        const latest = result[result.length - 1];
        if (!isTextInsert(latest)) {
          result.push(noop);
        }
        return result;
      });
    },
    [push]
  );

  return (
    <>
      {id === rootId && config?.template && (
        <TemplateHeader transforms={transforms} id={id} />
      )}
      <Editor
        target={target}
        push={pushWithBatching}
        register={actions.register}
        initialValue={initialEditorValue}
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
          <PushOnBlurPlugin push={push} hasLocalPush={hasLocalPush} />
          <OverlayWrapper />
          <BottomSelectionArea />
        </div>
      </Editor>
    </>
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
        <div className="font-medium opacity-50 mb-1 ml-1">Tilstand</div>
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
  hasLocalPush,
}: {
  push: (
    payload:
      | FieldOperation[1]
      | ((
          prev: FieldOperation[1] | undefined,
          noop: FieldOperation[1]
        ) => FieldOperation[1][])
  ) => void;
  hasLocalPush: React.MutableRefObject<boolean>;
}) {
  const editor = useEditorContext();

  const escapePush = React.useCallback(() => {
    push((prev, noop) => {
      if (!prev) {
        return [];
      }
      if (prev === noop) {
        return [prev];
      }
      return [prev, noop];
    });
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
