import cl from "clsx";
import { ColorToken, TokenStream, functions } from "@storyflow/backend/types";
import {
  ArrowUturnRightIcon,
  AtSymbolIcon,
  BoltIcon,
  ChevronLeftIcon,
  HashtagIcon,
  LinkIcon,
  PhotoIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  BLUR_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ESCAPE_COMMAND,
  LexicalEditor,
  LexicalNode,
} from "lexical";
import React from "react";
import { useClientConfig } from "../../client-config";
import { $isImportNode } from "../decorators/ImportNode";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import { tools } from "shared/editor-tools";
import { ComputationOp } from "shared/operations";
import { spliceTextWithNodes } from "../Editor/spliceTextWithNodes";
import {
  $getIndexFromPoint,
  $getNodeFromIndex,
  $isBlockNode,
  getNodesFromComputation,
} from "../Editor/transforms";
import type { LibraryConfig, RegularOptions } from "@storyflow/frontend/types";
import { useIsFocused } from "../../editor/react/useIsFocused";
import { useRestorableSelection } from "./useRestorableSelection";
import { useSelectedToken } from "./useSelectedToken";
import { useYPosition } from "./useYPosition";
import {
  QueryType,
  isAdjacent,
  isTextInsert,
  getQueryType,
  getOptionLabel,
} from "./helpers";
import { useFieldOptions } from "../default/FieldOptionsContext";
import { Option as OptionComponent } from "./Option";
import { useFieldRestriction } from "../FieldTypeContext";
import { useIsEmpty } from "../../editor/react/useIsEmpty";
import { QueryFiles } from "./QueryFiles";
import { QueryComponents } from "./QueryComponents";
import { QueryCommands } from "./QueryCommands";
import { QueryLinks } from "./QueryLinks";
import { QueryColors } from "./QueryColors";

const insertComputation = async (
  editor: LexicalEditor,
  insert: TokenStream,
  remove: number,
  libraries: LibraryConfig[],
  removeExtra?: boolean
) => {
  return await new Promise<boolean>((resolve) => {
    editor.update(
      () => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          console.error(
            "Tried to insert computation. But selection is not collapsed or not a range selection.",
            {
              isRangeSelection: $isRangeSelection(selection),
            }
          );
          resolve(false);
          return;
        }

        const anchor = selection.anchor;
        let node = anchor.getNode();
        const index = $getIndexFromPoint(anchor);

        if ($isRootNode(node) && node.getTextContent() === "") {
          const root = node;
          node = $createTextNode();
          root.append($createParagraphNode().append(node));
        }

        if ($isParagraphNode(node) && node.getTextContent() === "") {
          const p = node;
          node = $createTextNode();
          p.append(node);
        }

        if (!$isTextNode(node) || index === null) {
          console.error(
            "Tried to insert computation. But selection is not a text node or lacks index.",
            { isTextNode: $isTextNode(node) }
          );
          resolve(false);
          return;
        }

        const startIndex = anchor.offset - remove;
        const universalIndex = $getIndexFromPoint(anchor) - remove;

        if (insert.length === 1 && typeof insert[0] === "string") {
          try {
            node = node.spliceText(startIndex, remove, insert[0], true);
            if (node.getTextContent() === "") {
              node.remove();
            }
          } catch (err) {
            console.error(err);
            resolve(false);
            return;
          }
        } else {
          try {
            const nodes = getNodesFromComputation(insert, libraries);
            spliceTextWithNodes(node, startIndex, remove, nodes);
          } catch (err) {
            console.error(err);
            resolve(false);
            return;
          }
        }

        if (removeExtra) {
          const index = universalIndex - 1;
          const [node] = $getNodeFromIndex("symbol", index, $getRoot());
          if (node && $isImportNode(node)) {
            node?.remove();
          }
        }

        resolve(true);
      },
      { tag: "cms-command" }
    );
  });
};

const insertBlock = async (
  editor: LexicalEditor,
  insert: TokenStream,
  remove: number,
  libraries: LibraryConfig[]
) => {
  return await new Promise<boolean>((resolve) => {
    editor.update(
      () => {
        const newNode = getNodesFromComputation(insert, libraries)[0];
        const selection = $getSelection();

        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return resolve(false);
        }

        let node = selection.anchor.getNode();

        if (!$isTextNode(node)) return resolve(false);

        let parentNode: LexicalNode | null = node;

        while (parentNode && !$isBlockNode(parentNode)) {
          parentNode = parentNode!.getParent();
        }

        if (!parentNode) return resolve(false);

        node.spliceText(selection.anchor.offset - remove, remove, "", true);

        const isEmpty = node.getTextContent() === "";

        if (isEmpty) {
          parentNode.insertBefore(newNode);
        } else {
          parentNode.insertAfter(newNode);
        }
        resolve(true);
      },
      { tag: "cms-command" }
    );
  });
};

export function Query({
  push,
  children,
}: {
  push: (
    payload:
      | ComputationOp["ops"]
      | ((
          prev: ComputationOp["ops"] | undefined,
          noop: ComputationOp["ops"]
        ) => ComputationOp["ops"][])
  ) => void;
  children: (
    push: (payload: ComputationOp["ops"], tags: Set<string>) => void
  ) => React.ReactNode;
}) {
  const editor = useEditorContext();
  const { libraries } = useClientConfig();
  const options = useFieldOptions() ?? undefined;
  const restrictTo = useFieldRestriction();

  const [promptedQueryType, setPromptedQueryType] =
    React.useState<QueryType | null>(null);
  const [query, setQuery] = React.useState("");

  const [token_, setToken] = useSelectedToken(() => {});
  const token = (() => {
    if (token_ && "name" in token_) {
      const option = options?.find(
        (el) => typeof el === "object" && el.name === token_.name
      ) as { name: string; value?: unknown } | undefined;
      if (
        option &&
        restrictTo === "color" &&
        "value" in option &&
        typeof option.value === "string"
      ) {
        return { color: option.value } as ColorToken;
      }
    }
    return token_;
  })();

  const isFocused = useIsFocused();
  const isEmpty = useIsEmpty(editor);

  const defaultQueryType =
    {
      color: "#",
      image: ".",
    }[(restrictTo as string) ?? ""] ?? null;

  const queryType = (() => {
    if (promptedQueryType) return promptedQueryType;
    if (token) {
      if ("src" in token) {
        return ".";
      } else if ("color" in token) {
        return "#";
      }
    }
    if (isEmpty) {
      return defaultQueryType;
    }
    return null;
  })();

  const pushWithQuery = React.useCallback(
    (next: ComputationOp["ops"], tags: Set<string>) => {
      return push((prev, noop) => {
        let result: ComputationOp["ops"][] = [];

        console.log("PUSH INPUT", prev, next);

        if (!prev || prev === noop) {
          result = [next];
        } else {
          result = [prev, next];
          if (isAdjacent(prev, next)) {
            const nextIsSymbolInsert =
              isTextInsert(next) && next[0].insert[0].match(/([^\wæøå-])/)?.[1];

            if (
              !(!isTextInsert(prev) && isTextInsert(next)) &&
              (!nextIsSymbolInsert ||
                promptedQueryType === "@" ||
                promptedQueryType === "." ||
                (promptedQueryType === "/" && nextIsSymbolInsert === "/"))
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
                  console.log("PREV INSERT");
                  insert = tools.concat(prevInsert, next[0].insert ?? []);
                  remove = 0;
                }
              } else {
                insert = tools.concat(
                  prev[0].insert ?? [],
                  next[0].insert ?? []
                );
                remove = (prev[0].remove ?? 0) + (next[0].remove ?? 0);
              }

              const merged: ComputationOp["ops"] = [
                {
                  index,
                },
              ];
              if (insert.length) merged[0].insert = insert;
              if (remove) merged[0].remove = remove;
              result = [merged];
            }
          }
        }
        const latest = result[result.length - 1];
        if (isTextInsert(latest)) {
          const query = latest[0].insert[0];
          const index = latest[0].index;
          setQuery(query);
          const newQueryType = getQueryType(query, index);
          setPromptedQueryType(newQueryType);
        } else {
          setQuery("");
          setPromptedQueryType(null);
          result.push(noop);
        }
        console.log("PUSH RESULT", ...result);
        return result;
      });
    },
    [push, promptedQueryType, options]
  );

  const [hold, holdActions] = useRestorableSelection();

  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          console.log("blur", hold.current);
          if (!hold.current) escape();
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      )
      /*
      editor.registerCommand(
        CLICK_COMMAND,
        () => {
          if (!token && !options && !hold.current) {
            console.log("blick");
            escape();
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      )
      */
    );
  }, [push, token, options]);

  const [selected, setSelected] = React.useState(0);

  React.useEffect(() => {
    setSelected(0);
  }, [query, queryType]);

  const queryString =
    promptedQueryType && query.startsWith(promptedQueryType)
      ? query.slice(1)
      : query;

  const promptedFunction = functions.includes(queryString as any);

  const hasOptions =
    options &&
    options.length > 0 &&
    !["children", "color"].includes(restrictTo as any);

  const [showOptions, setShowOptions] = React.useState(false);

  React.useEffect(() => {
    if (hasOptions && !hold.current) {
      setShowOptions(isFocused);
    }
  }, [isFocused]);

  const show =
    (isFocused || hold.current) &&
    Boolean(queryType || promptedFunction || showOptions);

  React.useEffect(() => {
    if (show) {
      return mergeRegister(
        editor.registerCommand(
          KEY_ARROW_DOWN_COMMAND,
          (ev) => {
            ev?.preventDefault();
            setSelected((ps) => ps + 1);
            return true;
          },
          COMMAND_PRIORITY_HIGH
        ),
        editor.registerCommand(
          KEY_ARROW_UP_COMMAND,
          (ev) => {
            ev?.preventDefault();
            setSelected((ps) => (ps > -1 ? ps - 1 : 0));
            return true;
          },
          COMMAND_PRIORITY_HIGH
        ),
        editor.registerCommand(
          KEY_ESCAPE_COMMAND,
          (ev) => {
            ev?.preventDefault();
            escape();
            return true;
          },
          COMMAND_PRIORITY_HIGH
        )
      );
    } else if (hasOptions) {
      return editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (ev) => {
          ev?.preventDefault();
          setShowOptions(true);
          return true;
        },
        COMMAND_PRIORITY_HIGH
      );
    }
  }, [show, hasOptions]);

  const escape = () => {
    console.log("ESCAPE");
    setQuery("");
    setPromptedQueryType(null);
    setShowOptions(false);
    push((prev, noop) => {
      if (!prev) {
        return [];
      }
      if (prev === noop) {
        return [prev];
      }
      return [prev, noop];
    });
  };

  const reset = () => {
    console.log("RESET");
    setQuery("");
    setPromptedQueryType(null);
    setShowOptions(false);
    resetEditorQuery();
  };

  const resetEditorQuery = async () => {
    return await new Promise<boolean>((resolve) => {
      editor.update(
        () => {
          const selection = $getSelection();

          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return resolve(false);
          }

          let node = selection.anchor.getNode();

          node.spliceText(
            selection.anchor.offset - query.length,
            query.length,
            "",
            true
          );
        },
        { tag: "cms-command" }
      );
    });
  };

  const y = useYPosition(editor, show);

  const QueryIcon = {
    "": null,
    "#": HashtagIcon,
    "<": ChevronLeftIcon,
    "@": AtSymbolIcon,
    "/": LinkIcon,
    ".": PhotoIcon,
  }[queryType ?? ""];

  const queryTitle = {
    "": "Valgmuligheder",
    "#": "Indsæt farve",
    "<": "Indsæt element",
    ".": "Find billede",
    "@": "Opslag",
    "/": "Generer linkadresse",
  }[queryType ?? ""];

  const insertComputationSimple = React.useCallback(
    async (insert: TokenStream, removeExtra?: boolean) => {
      const success = await insertComputation(
        editor,
        insert,
        query.length,
        libraries,
        removeExtra
      );
      if (success) {
        setQuery("");
        setPromptedQueryType(null);
        setShowOptions(false);
      }
    },
    [editor, query, libraries]
  );

  const insertBlockSimple = React.useCallback(
    async (insert: TokenStream) => {
      const success = await insertBlock(
        editor,
        insert,
        query.length,
        libraries
      );
      if (success) {
        setQuery("");
        setPromptedQueryType(null);
        setShowOptions(false);
      }
    },
    [editor, query, libraries]
  );

  const filteredOptions = React.useMemo(
    () =>
      options?.filter((el) => {
        return String(getOptionLabel(el))
          .toLowerCase()
          .startsWith(queryString.toLowerCase());
      }) ?? [],
    [options, query]
  );

  const onOptionEnter = React.useCallback(
    (option: RegularOptions[number]) => {
      if (typeof option !== "object") {
        insertComputationSimple([option]);
      } else if ("name" in option && typeof option.name !== "undefined") {
        insertComputationSimple([{ name: option.name }]);
      } else if ("value" in option && typeof option.value !== "undefined") {
        insertComputationSimple([option.value]);
      }
    },
    [insertComputationSimple]
  );

  return (
    <>
      <div
        className={cl(
          "absolute left-5 right-5 z-10 bg-gray-800 ring-1 ring-gray-700 rounded shadow-lg font-light",
          show
            ? "opacity-100 transition-opacity"
            : "opacity-0 pointer-events-none"
        )}
        style={{ transform: `translate(0px, ${y}px)` }}
      >
        <div className="flex flex-col">
          <div
            className={cl(
              "pt-3 relative h-10 px-5 text-opacity-50 text-gray-300 text-xs flex items-center rounded"
            )}
          >
            <div>{QueryIcon && <QueryIcon className="w-4 h-4" />}</div>
            <div className="ml-3">{queryTitle}</div>
            {query && (
              <div
                className={cl(
                  "ml-auto flex gap-2 h-full rounded -mx-3 px-3 items-center hover:bg-gray-700 transition-colors",
                  -1 === selected && "ring-1 ring-gray-700"
                )}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  reset();
                }}
              >
                Slet forespørgsel
                {selected === -1 ? (
                  <ArrowUturnRightIcon className="w-4 h-4 rotate-180" />
                ) : (
                  <XMarkIcon className="w-4 h-4" />
                )}
              </div>
            )}
          </div>
          <div className="p-2 max-h-60 overflow-y-auto no-scrollbar flex flex-col gap-1">
            {queryType === "#" && (
              <QueryColors
                selected={selected}
                query={queryString}
                insertComputation={insertComputationSimple}
                setToken={token && "color" in token ? setToken : undefined}
                initialColor={
                  token && "color" in token ? token.color : undefined
                }
                options={restrictTo === "color" ? options : []}
              />
            )}
            {queryType === "<" && (
              <QueryComponents
                selected={selected}
                query={queryString}
                insertBlock={insertBlockSimple}
                insertComputation={insertComputationSimple}
                options={restrictTo === "children" ? options ?? [] : []}
              />
            )}
            {queryType === "@" && (
              <QueryCommands
                selected={selected}
                query={queryString}
                insertBlock={insertBlockSimple}
              />
            )}
            {queryType === "/" && (
              <QueryLinks
                selected={selected}
                query={queryString}
                insertComputation={insertComputationSimple}
              />
            )}
            {queryType === "." && (
              <QueryFiles
                selected={selected}
                query={queryString}
                reset={reset}
                holdActions={holdActions}
                insertComputation={insertComputationSimple}
              />
            )}
            {!promptedQueryType && promptedFunction && (
              <OptionComponent
                value={promptedFunction}
                isSelected={true}
                onEnter={() => {}}
                Icon={BoltIcon}
              >
                Indsæt funktion: "{queryString}()"
              </OptionComponent>
            )}
            {showOptions &&
              filteredOptions.map((option, i) => (
                <OptionComponent
                  value={option}
                  isSelected={selected === i}
                  onEnter={onOptionEnter}
                >
                  {getOptionLabel(option)}
                </OptionComponent>
              ))}
          </div>
        </div>
      </div>
      {React.useMemo(() => children(pushWithQuery), [pushWithQuery])}
    </>
  );
}
