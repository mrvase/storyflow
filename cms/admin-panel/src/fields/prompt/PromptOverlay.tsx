import {
  CubeIcon,
  CursorArrowRaysIcon,
  DocumentIcon,
  LinkIcon,
  PhotoIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import cl from "clsx";
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ESCAPE_COMMAND,
} from "lexical";
import React from "react";
import { useAppConfig } from "../../AppConfigContext";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import type { TokenStream } from "../../operations/types";
import PromptNode, { $isPromptNode } from "../Editor/decorators/PromptNode";
import { $replaceWithBlocks } from "../Editor/insertComputation";
import { $createBlocksFromStream } from "../Editor/transforms";
import {
  useActionFieldId,
  useFieldOptions,
  useFieldRestriction,
} from "../FieldIdContext";
import { ElementPrompt } from "./ElementPrompt";
import { FilePrompt } from "./FilePrompt";
import { OptionEventsPlugin, Options } from "./OptionsContext";
import { OptionsPrompt } from "./OptionsPrompt";
import { ParagraphStylePrompt } from "./ParagraphStylePrompt";
import { ReferencePrompt } from "./ReferencePrompt";
import { TemplatePrompt } from "./TemplatePrompt";
import { TokenPrompt } from "./TokenPrompt";
import { UrlPrompt } from "./UrlPrompt";
import { HoldActions } from "./useRestorableSelection";
import { $exitPromptNode, $getPromptNode } from "./utils";
import { FunctionPrompt } from "./FunctionPrompt";
import { AIPrompt } from "./AIPrompt";
import { FormPrompt } from "./FormPrompt";

const panes = [
  {
    id: "actions",
    icon: CursorArrowRaysIcon,
    label: "Handlinger",
  },
  {
    id: "elements",
    icon: CubeIcon,
    label: "Elementer",
  },
  {
    id: "documents",
    icon: DocumentIcon,
    label: "Dokumenter",
  },
  {
    id: "urls",
    icon: LinkIcon,
    label: "URLS",
  },
  {
    id: "images",
    icon: PhotoIcon,
    label: "Billeder",
  },
] satisfies { id: string; icon: React.FC<any>; label: string }[];

export function PromptOverlay({
  node,
  prompt,
  children,
  holdActions,
  generatorId,
}: {
  node: PromptNode;
  prompt: string;
  children?: React.ReactNode;
  holdActions: HoldActions;
  generatorId: string;
}) {
  const editor = useEditorContext();

  const { initializer, stream } = React.useMemo(() => {
    const initializer = node.__initializer;
    const stream = node.__stream;
    return {
      initializer,
      stream,
    };
  }, []);

  const showMenu = initializer === "/";

  const { configs } = useAppConfig();

  React.useEffect(() => {
    return editor.registerNodeTransform(PromptNode, (node) => {
      if (node.getTextContent() === "\uFEFF") {
        $exitPromptNode(configs, node);
      } else if (node.getTextContent() === "\uFEFF\uFEFF/") {
        node.select(0, 3);
        const p = $createParagraphNode();
        p.append($createTextNode("/"));
        $replaceWithBlocks([p]);
      } else if (node.getTextContent() === "\uFEFF\uFEFF@") {
        node.select(0, 3);
        const p = $createParagraphNode();
        p.append($createTextNode("@"));
        $replaceWithBlocks([p]);
      }
    });
  }, [editor, configs]);

  /*
  React.useEffect(() => {
    return editor.registerMutationListener(PromptNode, (mutatedNodes) => {
      // mutatedNodes is a Map where each key is the NodeKey, and the value is the state of mutation.
      for (let [nodeKey, mutation] of mutatedNodes) {
        if (mutation === "destroyed") {
          console.log($getNodeByKey(nodeKey, editor.getEditorState()));
        }
        console.log(nodeKey, mutation);
      }
    });
  }, [editor]);
  */
  const restrictTo = useFieldRestriction();
  const actionFieldId = useActionFieldId();

  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        (ev) => {
          if (!showMenu) return false;

          const isAtStart = editor.getEditorState().read(() => {
            const selection = $getSelection();
            if (
              !$isRangeSelection(selection) ||
              !selection.isCollapsed() ||
              selection.anchor.type !== "text"
            ) {
              return false;
            }
            return (
              $isPromptNode(selection.anchor.getNode()) &&
              selection.anchor.offset === 2
            );
          });

          if (!isAtStart) return false;

          ev?.preventDefault();

          setCurrentPane((ps = "actions") => {
            const currentIndex = visiblePanes.findIndex((p) => p.id === ps);
            return currentIndex <= 0
              ? visiblePanes[visiblePanes.length - 1].id
              : visiblePanes[currentIndex - 1].id;
          });
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_ARROW_RIGHT_COMMAND,
        (ev) => {
          if (!showMenu) return false;

          const isAtEnd = editor.getEditorState().read(() => {
            const selection = $getSelection();
            if (
              !$isRangeSelection(selection) ||
              !selection.isCollapsed() ||
              selection.anchor.type !== "text"
            ) {
              return false;
            }
            return (
              $getPromptNode()?.getTextContent().length ===
              selection.anchor.offset
            );
          });

          if (!isAtEnd) return false;
          ev?.preventDefault();

          setCurrentPane((ps = "actions") => {
            const currentIndex = visiblePanes.findIndex((p) => p.id === ps);
            return currentIndex === visiblePanes.length - 1
              ? visiblePanes[0].id
              : visiblePanes[currentIndex + 1].id;
          });
          return true;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [editor, showMenu, restrictTo]);

  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (ev) => {
          ev?.preventDefault();
          editor.update(() => {
            $exitPromptNode(configs);
          });
          return true;
        },
        COMMAND_PRIORITY_HIGH
      )
      /*
      // handled in Overlay
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          editor.update(() => {
            $exitPromptNode(configs);
            $setSelection(null);
          });
          return false;
        },
        COMMAND_PRIORITY_HIGH
      )
      */
    );
  }, [editor, configs]);

  const [currentPane_, setCurrentPane] =
    React.useState<(typeof panes)[number]["id"]>();

  let visiblePanes: (typeof panes)[number][] = panes;
  if (restrictTo !== "children") {
    visiblePanes = panes.filter((el) => el.id !== "elements");
  }

  const defaultPane = {
    "/": "actions",
    "<": "elements",
    "@": "documents",
  }[initializer ?? "/"];

  const currentPane = currentPane_ ?? defaultPane;

  const options = useFieldOptions() ?? undefined;

  const replacePromptWithStream = React.useCallback(
    (stream: TokenStream) => {
      editor.update(() => {
        $getPromptNode()?.select(0);
        const blocks = $createBlocksFromStream(stream, configs);
        $replaceWithBlocks(blocks);
      });
    },
    [editor, configs]
  );

  return (
    <Options>
      <OptionEventsPlugin />
      <button
        className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-white hover:bg-gray-100 dark:bg-gray-800 border border-gray-400 dark:border-gray-700 dark:hover:bg-gray-750 transition-colors flex-center"
        onMouseDown={(ev) => {
          ev.preventDefault();
        }}
        onClick={() => {
          editor.update(() => {
            $exitPromptNode(configs);
          });
        }}
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
      {showMenu && (
        <div className="flex gap-2.5 p-2.5 text-xs">
          {visiblePanes.map((pane, index) => (
            <div
              key={index}
              className={cl(
                "flex-center gap-2 rounded cursor-default py-2 px-3 transition-opacity font-medium",
                "grow shrink basis-0",
                currentPane === pane.id
                  ? "bg-gray-100 dark:bg-gray-800"
                  : "opacity-75 hover:opacity-100"
              )}
              onMouseDown={(ev) => {
                ev.preventDefault();
              }}
              onClick={() => {
                setCurrentPane(pane.id);
              }}
            >
              <pane.icon className="w-4 h-4" />
              {pane.label}
            </div>
          ))}
        </div>
      )}
      <div className="max-h-52 overflow-y-auto no-scrollbar m-[1px]">
        {stream && stream.length > 0 && (
          <div className="p-2.5">
            <div className="bg-yellow-100 dark:bg-yellow-500/20 text-yellow-900 dark:text-yellow-200 rounded p-2.5">
              {JSON.stringify(stream)}
            </div>
          </div>
        )}
        {currentPane === "actions" && (
          <>
            {restrictTo === "children" && (
              <ParagraphStylePrompt prompt={prompt} />
            )}
            {actionFieldId && (
              <FormPrompt
                actionFieldId={actionFieldId}
                prompt={prompt}
                replacePromptWithStream={replacePromptWithStream}
              />
            )}
            {restrictTo === "data" && <TemplatePrompt prompt={prompt} />}
            <TokenPrompt
              prompt={prompt}
              replacePromptWithStream={replacePromptWithStream}
            />
            <FunctionPrompt prompt={prompt} />
            <AIPrompt
              node={node}
              generatorId={generatorId}
              prompt={prompt}
              stream={stream}
              replacePromptWithStream={replacePromptWithStream}
            />
            {options && ["string", "number"].includes(restrictTo!) && (
              <OptionsPrompt options={options} />
            )}
            {children}
          </>
        )}
        {currentPane === "elements" && (
          <ElementPrompt
            prompt={prompt}
            stream={stream}
            options={restrictTo === "children" ? options : undefined}
            replacePromptWithStream={replacePromptWithStream}
          />
        )}
        {currentPane === "documents" && (
          <ReferencePrompt
            prompt={prompt}
            replacePromptWithStream={replacePromptWithStream}
          />
        )}
        {currentPane === "urls" && (
          <UrlPrompt
            prompt={prompt}
            replacePromptWithStream={replacePromptWithStream}
          />
        )}
        {currentPane === "images" && (
          <FilePrompt
            prompt={prompt}
            replacePromptWithStream={replacePromptWithStream}
            holdActions={holdActions}
          />
        )}
      </div>
    </Options>
  );
}
