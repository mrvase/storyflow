import React from "react";
import cl from "clsx";
import type { DocumentId, FieldId } from "@storyflow/shared/types";
import { getDocumentId, getRawFieldId } from "@storyflow/cms/ids";
import { useFieldId } from "../FieldIdContext";
import { createTokenStream } from "../../operations/parse-token-stream";
import { usePush } from "../../collab/CollabContext";
import { ContentEditable } from "../../editor/react/ContentEditable";
import Editor from "../Editor/Editor";
import { getPreview } from "./getPreview";
import { PromptButton } from "../prompt/PromptButton";
import { TemplateHeader } from "./TemplateHeader";
import { tools } from "../../operations/stream-methods";
import { useDefaultState } from "./useDefaultState";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { $getRoot, BLUR_COMMAND, COMMAND_PRIORITY_EDITOR } from "lexical";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import { Overlay } from "../prompt/Overlay";
import { useMathMode } from "../Editor/useMathMode";
import { Bars2Icon, VariableIcon } from "@heroicons/react/24/outline";
import { FieldTemplateIdContext } from "./FieldTemplateContext";
import {
  FieldTransactionEntry,
  StreamOperation,
  TransformOperation,
} from "../../operations/actions";
import { Transaction } from "@storyflow/collab/types";
import { createTransaction } from "@storyflow/collab/utils";
import { PushFunction } from "@storyflow/collab/Queue";
import { HeadingNode } from "../../editor/react/HeadingNode";
import nodes from "../Editor/decorators/nodes";
import { CreatorCircularImport } from "../Editor/decorators/CreatorNode";
import { LayoutElementCircularImport } from "../Editor/decorators/LayoutElementNode";
import { FolderCircularImport } from "../Editor/decorators/FolderNode";
import useIsFocused from "../../utils/useIsFocused";
import { useIsEmpty } from "../../editor/react/useIsEmpty";
import { createObjectKeyMap } from "../../utils/createObjectKey";
import { isAdjacent, isTextInsert, isTextDeletion } from "./merge";
import { FieldProps } from "../types";
import { ExtendPath } from "../Path";
import { PreloadFieldState } from "./PreloadFieldState";
import { useAttributesContext } from "../Attributes";

CreatorCircularImport.DefaultField = DefaultField;
LayoutElementCircularImport.DefaultField = DefaultField;
FolderCircularImport.DefaultField = DefaultField;

const allNodes = [HeadingNode, ...nodes];

const objectKeys = createObjectKeyMap();

export function DefaultFieldRoot({ id }: FieldProps) {
  const [currentProp] = useAttributesContext();
  const currentId = currentProp ?? id;

  return (
    <>
      <PreloadFieldState id={id} />
      <ExtendPath id={currentId} type="field">
        <DefaultField key={currentId} id={currentId} showPromptButton />
      </ExtendPath>
    </>
  );
}

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
        key={objectKeys.get(initialEditorValue)}
        target={target}
        push={mergePush}
        tracker={tracker}
        initialValue={initialEditorValue}
        nodes={allNodes}
      >
        <div className={cl("relative")}>
          <ContentEditableWithPlaceholder />
          <BottomSelectionArea />
          {showPromptButton && <PromptButton />}
          <PushOnBlurPlugin
            push={push}
            tracker={tracker}
            hasLocalPush={hasLocalPush}
          />
          <OverlayWrapper />
          <div className="absolute right-2.5 top-0">
            {transforms.length ? (
              <VariableIcon className="w-4 h-4 my-1 opacity-50" />
            ) : null}
          </div>
        </div>
        {!isPrimitive && (
          <div className="-ml-[3.125rem] flex items-center text-gray-400 rounded text-sm px-2.5 pt-2.5">
            <Bars2Icon className="shrink-0 w-5 h-5 mt-0.5 mr-5 opacity-50" />
            {preview || "[Tom]"}
          </div>
        )}
      </Editor>
    </FieldTemplateIdContext.Provider>
  );
}

function ContentEditableWithPlaceholder() {
  //
  const editor = useEditorContext();
  const isFocused = useIsFocused();
  const isEmpty = useIsEmpty(editor);

  return (
    <ContentEditable
      className={cl(
        "relative grow editor outline-none selection:bg-gray-200 dark:selection:bg-gray-700",
        "text-base leading-6 px-2.5 rounded-lg border",
        "border-gray-200 has-editor-focus:border-gray-200 hover:border-gray-250 focus:border-gray-300 dark:border-gray-700 dark:has-editor-focus:border-gray-700 dark:hover:border-gray-650 dark:focus:border-gray-550",
        "transition-colors",
        "bg-white dark:bg-gray-900",
        "[&:before]:text-gray-400 [&:before]:dark:text-gray-500"
      )}
      data-placeholder={
        isEmpty
          ? isFocused
            ? 'Skriv "/" for genveje'
            : "Ikke udfyldt"
          : undefined
      }
    />
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
          $getRoot().select();
        });
      }}
    />
  );
}

function OverlayWrapper() {
  const [mathMode, setMathMode] = useMathMode();

  return (
    <Overlay>
      {/*<div className="p-2.5">
        <div className="font-medium text-gray-400 mb-1 ml-1">Tilstand</div>
        <Option
          value={null}
          onEnter={() => {
            setMathMode((ps) => !ps);
          }}
        >
          {mathMode ? "Deaktiver" : "Aktiver"} listetilstand
        </Option>
      </div>*/}
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
