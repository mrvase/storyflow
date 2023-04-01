import {
  CalendarDaysIcon,
  CheckIcon,
  CubeIcon,
  CursorArrowRaysIcon,
  DocumentIcon,
  LinkIcon,
  PhotoIcon,
  SwatchIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import { TokenStream } from "@storyflow/backend/types";
import cl from "clsx";
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ESCAPE_COMMAND,
} from "lexical";
import React from "react";
import { useClientConfig } from "../../client-config";
import { useEditorContext } from "../../editor/react/EditorProvider";
import PromptNode, { $isPromptNode } from "../decorators/PromptNode";
import { useFieldOptions, useFieldRestriction } from "../FieldIdContext";
import { $replaceWithBlocks } from "../Editor/insertComputation";
import { $getBlocksFromComputation } from "../Editor/transforms";
import { ElementPrompt } from "./ElementPrompt";
import { FilePrompt } from "./FilePrompt";
import { Options, useOptionActions } from "./OptionsContext";
import { UrlPrompt } from "./UrlPrompt";
import { ParagraphStylePrompt } from "./ParagraphStylePrompt";
import { HoldActions } from "./useRestorableSelection";

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
] as const;

const $getPromptNode = () => {
  const selection = $getSelection();

  if (!$isRangeSelection(selection)) {
    return;
  }

  return selection
    .getNodes()
    .find((node): node is PromptNode => $isPromptNode(node));
};

function OptionEventsPlugin() {
  const editor = useEditorContext();
  const actions = useOptionActions();

  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (ev) => {
          ev?.preventDefault();
          actions.selectNext();
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (ev) => {
          ev?.preventDefault();
          actions.selectPrevious();
          return true;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  }, []);

  React.useEffect(() => {
    actions.goToItem(0);
  }, []);

  return null;
}

export function Prompt({
  node,
  prompt,
  children,
  holdActions,
}: {
  node: PromptNode;
  prompt: string;
  children?: React.ReactNode;
  holdActions: HoldActions;
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

  const { libraries } = useClientConfig();

  const $exitPromptNode = React.useCallback(
    (node_?: PromptNode) => {
      const node = node_ ?? $getPromptNode();

      if (!node) {
        return;
      }

      const stream = node.getTokenStream();
      if (stream.length) {
        node.select(0);
        $replaceWithBlocks(
          editor,
          $getBlocksFromComputation(stream, libraries)
        );
      } else {
        node.remove();
      }
    },
    [editor, libraries]
  );

  React.useEffect(() => {
    return editor.registerNodeTransform(PromptNode, (node) => {
      if (node.getTextContent() === "\uFEFF") {
        $exitPromptNode(node);
      } else if (node.getTextContent() === "\uFEFF\uFEFF/") {
        node.select(0, 3);
        const p = $createParagraphNode();
        p.append($createTextNode("/"));
        $replaceWithBlocks(editor, [p]);
      }
    });
  }, [editor]);

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
            const currentIndex = panes.findIndex((p) => p.id === ps);
            return currentIndex <= 0
              ? panes[panes.length - 1].id
              : panes[currentIndex - 1].id;
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
            const currentIndex = panes.findIndex((p) => p.id === ps);
            return currentIndex === panes.length - 1
              ? panes[0].id
              : panes[currentIndex + 1].id;
          });
          return true;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [editor, showMenu]);

  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (ev) => {
          ev?.preventDefault();
          editor.update(() => {
            $exitPromptNode();
          });
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          editor.update(() => {
            $exitPromptNode();
            $setSelection(null);
          });
          return false;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [editor]);

  const [currentPane_, setCurrentPane] =
    React.useState<(typeof panes)[number]["id"]>();

  const defaultPane = {
    "/": "actions",
    "<": "elements",
    "@": "documents",
  }[initializer ?? "/"];

  const currentPane = currentPane_ ?? defaultPane;

  const options = useFieldOptions() ?? undefined;
  const restrictTo = useFieldRestriction();

  const replacePromptWithStream = React.useCallback(
    (stream: TokenStream) => {
      editor.update(() => {
        $getPromptNode()?.select(0);
        const blocks = $getBlocksFromComputation(stream, libraries);
        $replaceWithBlocks(editor, blocks);
      });
    },
    [editor, libraries]
  );

  return (
    <Options>
      <OptionEventsPlugin />
      {showMenu && (
        <div className="grid grid-cols-5 gap-2.5 p-2.5 text-xs">
          {panes.map((pane, index) => (
            <div
              key={index}
              className={cl(
                "flex-center gap-2 rounded cursor-default py-2 px-3 transition-opacity",
                currentPane === pane.id
                  ? "bg-gray-800"
                  : "opacity-50 hover:opacity-100"
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
      {stream && stream.length > 0 ? (
        <div className="p-2.5">
          <div className="bg-yellow-500/20 text-yellow-200 rounded p-2.5">
            {JSON.stringify(stream)}
          </div>
        </div>
      ) : (
        <>
          {currentPane === "actions" && (
            <>
              <div className="p-2.5">
                <div className="p-2.5 rounded">
                  <div className="group flex items-center gap-2">
                    <div className="group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity cursor-default bg-gradient-to-b from-cyan-600 to-cyan-700 shadow-sm text-sky-100/90 rounded px-2 py-0.5 flex-center gap-2">
                      <CalendarDaysIcon className="w-4 h-4 inline" />
                      25. marts 2023
                    </div>
                    <div
                      className="group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity cursor-default bg-gradient-to-b dark:bg-white shadow-sm text-black rounded px-2 py-0.5 flex-center gap-2"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                      }}
                      onClick={() => {
                        replacePromptWithStream([{ color: "#ffffff" }]);
                      }}
                    >
                      <SwatchIcon className="w-4 h-4 inline" />
                      White
                    </div>
                    <div className="group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity cursor-default bg-gradient-to-b from-emerald-600 to-emerald-700 shadow-sm text-green-100/90 rounded px-2 py-0.5 flex-center gap-2">
                      <CheckIcon className="w-4 h-4 inline" />
                      Sand
                    </div>
                    <div className="group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity cursor-default bg-gradient-to-b from-pink-600 to-pink-700 shadow-sm text-red-100/90 rounded px-2 py-0.5 flex-center gap-2">
                      <XMarkIcon className="w-4 h-4 inline" />
                      Falsk
                    </div>
                  </div>
                </div>
              </div>
              <ParagraphStylePrompt />
              {children}
            </>
          )}
          {currentPane === "elements" && (
            <ElementPrompt
              prompt={prompt}
              options={restrictTo === "children" ? options ?? [] : []}
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
        </>
      )}
    </Options>
  );
}
