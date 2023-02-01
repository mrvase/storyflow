import cl from "clsx";
import {
  EditorComputation,
  FieldImport,
  functions,
  TokenString,
  Value,
} from "@storyflow/backend/types";
import { LABEL_ID, URL_ID } from "@storyflow/backend/templates";
import { computeFieldId, createId } from "@storyflow/backend/ids";
import {
  ArrowRightIcon,
  ArrowUturnRightIcon,
  AtSymbolIcon,
  BoltIcon,
  ChevronLeftIcon,
  ComputerDesktopIcon,
  CubeIcon,
  DocumentIcon,
  HashtagIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  RocketLaunchIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  BLUR_COMMAND,
  CLICK_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  EditorState,
  FOCUS_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  LexicalNode,
} from "lexical";
import React from "react";
import { useClientConfig } from "../client-config";
import { SWRClient } from "../client";
import $createRangeSelection from "../editor/createRangeSelection";
import { $isImportNode } from "../fields/decorators/ImportNode";
import { $isTokenNode, getTokenType, TokenNode } from "./decorators/TokenNode";
import { useEditorContext } from "../editor/react/EditorProvider";
import { mergeRegister } from "../editor/utils/mergeRegister";
import { useAppFolders } from "../folders";
import { tools } from "shared/editor-tools";
import { ComputationOp } from "shared/operations";
import { useGlobalState } from "../state/state";
import { getFileType, getImageSize, getVideoSize } from "../utils/file";
import { spliceTextWithNodes } from "./Editor/spliceTextWithNodes";
import { createComponent } from "./Editor/createComponent";
import {
  $getComputation,
  $getIndexFromPoint,
  $getNodeFromIndex,
  $getPointFromIndex,
  $isBlockNode,
  getNodesFromComputation,
} from "./Editor/transforms";
import { useFiles } from "../files";
import { Spinner } from "../elements/Spinner";
import { useOrganisationSlug } from "../users";

type TextOps = [{ index: number; insert: [string]; remove?: 0 }];

const useRestorableSelection = () => {
  const [savedSelection, setSavedSelection] = React.useState<number | null>(
    null
  );

  const editor = useEditorContext();

  const hold = React.useCallback(() => {
    const result = editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return null;
      return $getIndexFromPoint(selection.anchor);
    });
    setSavedSelection(result);
  }, [editor]);

  const restore = React.useCallback(async () => {
    if (!savedSelection) return;
    await new Promise((resolve, reject) =>
      editor.update(() => {
        try {
          const [anchorNode, anchorOffset] = $getPointFromIndex(
            "cursor",
            savedSelection
          );
          if ($isTextNode(anchorNode)) {
            const point = { node: anchorNode, offset: anchorOffset };
            const newSelection = $createRangeSelection(point, point);
            $setSelection(newSelection);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (err) {
          reject();
        }
      })
    );
    setSavedSelection(null);
  }, [editor, savedSelection]);

  const actions = React.useMemo(() => ({ hold, restore }), [hold, restore]);

  return [Boolean(savedSelection), actions] as [boolean, typeof actions];
};

const useSelectedToken = (callback: (token: TokenString) => void) => {
  const [tokenNode, setTokenNode] = React.useState<{
    key: string;
    value: TokenString;
  }>();

  const type = tokenNode ? getTokenType(tokenNode.value) : undefined;

  const editor = useEditorContext();

  React.useEffect(() => {
    const update = (editorState: EditorState) => {
      const state = editorState.read(() => {
        const selection = $getSelection();

        if (!$isNodeSelection(selection)) return;
        const nodes = selection.getNodes();
        if (nodes.length !== 1) return;
        const [node] = nodes;

        if (!$isTokenNode(node)) return;

        return {
          value: node.getToken()[0],
          key: node.__key,
        };
      });

      if (state) callback(state.value);
      setTokenNode(state);
    };
    return mergeRegister(
      editor.registerCommand(
        FOCUS_COMMAND,
        () => {
          console.log("focus");
          update(editor.getEditorState());
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          setTokenNode(undefined);
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerUpdateListener(({ editorState }) => {
        console.log("update");
        update(editorState);
      })
    );
  }, [editor]);

  const token = { value: tokenNode?.value, type };

  const setToken = (value: string) => {
    if (!tokenNode) return;
    editor.update(() => {
      const node = $getNodeByKey(tokenNode.key) as TokenNode | null;
      node?.setToken([value as TokenString]);
    });
  };

  return [token, setToken] as [typeof token, typeof setToken];
};

const isTextInsert = (ops: ComputationOp["ops"]): ops is TextOps => {
  return (
    ops.length === 1 &&
    Array.isArray(ops[0].insert) &&
    ops[0].insert.length === 1 &&
    !ops[0].remove &&
    typeof ops[0].insert[0] === "string"
  );
};

const isAdjacent = (
  prev: ComputationOp["ops"],
  next: ComputationOp["ops"]
): boolean => {
  if (prev.length !== 1 || next.length !== 1) return false;
  const prevEndingIndex =
    prev[0].index +
    tools.getLength(prev[0].insert ?? []) -
    (prev[0].remove ?? 0);
  const nextStartingIndex = next[0].index + (next[0].remove ?? 0);
  return prevEndingIndex === nextStartingIndex;
};

const isNoop = (ops: ComputationOp["ops"]): ops is TextOps => {
  return ops.length === 1 && !ops[0].insert && !ops[0].remove;
};

type QueryType = "<" | "@" | "#" | "/" | ".";

const getQueryType = (query: string, index: number): QueryType | null => {
  const match = query.match(/^([\@\#\/\<\.])/)?.[1] as QueryType | null;
  if (match === "." && index !== 0) {
    return null;
  }
  return match;
};

export function Query({
  push,
  children,
  options,
}: {
  push: (
    payload:
      | ComputationOp["ops"]
      | ((prev: ComputationOp["ops"] | undefined) => ComputationOp["ops"][]),
    noTracking?: boolean
  ) => void;
  children: (
    push: (payload: ComputationOp["ops"], tags: Set<string>) => void
  ) => React.ReactNode;
  options?: string[];
}) {
  const [queryType, setQueryType] = React.useState<QueryType | null>(null);
  const [query, setQuery] = React.useState("");

  const [token] = useSelectedToken(() => {});

  React.useEffect(() => {
    token?.value ? setQueryType(".") : setQueryType(null);
  }, [token?.value]);

  const pushWithQuery = React.useCallback(
    (next: ComputationOp["ops"], tags: Set<string>) => {
      return push((prev) => {
        let result: ComputationOp["ops"][] = [];

        console.log("PUSH INPUT", prev, next);

        if (!prev || isNoop(prev)) {
          result = [next];
        } else {
          result = [prev, next];

          if (isAdjacent(prev, next)) {
            console.log("IS ADJACENT");
            const nextIsSymbolInsert =
              isTextInsert(next) && next[0].insert[0].match(/([^\w-])/)?.[1];

            if (
              !(!isTextInsert(prev) && isTextInsert(next)) &&
              (!nextIsSymbolInsert ||
                queryType === "@" ||
                queryType === "." ||
                (queryType === "/" && nextIsSymbolInsert === "/"))
            ) {
              let insert: EditorComputation = [];
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
          setQueryType(getQueryType(query, index));
        } else {
          setQuery("");
          setQueryType(null);
        }
        console.log("PUSH RESULT", ...result);
        return result;
      });
    },
    [push, queryType]
  );

  const [hold, holdActions] = useRestorableSelection();

  React.useEffect(() => {
    if (hold) return;
    return mergeRegister(
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          escape();
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand(
        CLICK_COMMAND,
        () => {
          if (!token) escape();
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      )
    );
  }, [push, hold, token]);

  const [y, setState] = React.useState(0);

  const queryString = queryType ? query.slice(1) : query;

  const [selected, setSelected] = React.useState(0);

  const editor = useEditorContext();
  const { libraries } = useClientConfig();

  React.useEffect(() => {
    setSelected(0);
    if (query || queryType) {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const key = selection.anchor.key;
          let DOMNode: HTMLElement | null = editor.getElementByKey(key);
          const EditorNode = editor.getRootElement();
          if (!DOMNode || !EditorNode) return;
          const range = document.createRange();
          try {
            range.setEnd(DOMNode.firstChild!, selection.anchor.offset);
            range.setStart(
              DOMNode.firstChild!,
              selection.anchor.offset - query.length
            );
            const editorRect = EditorNode.getBoundingClientRect();
            const rangeRect = range.getBoundingClientRect();
            setState(rangeRect.y + rangeRect.height - editorRect.y + 8);
          } catch (err) {
            console.error(err);
          }
        } else if ($isNodeSelection(selection)) {
          console.log("NODE SELECTION");
          const nodes = selection.getNodes();
          if (nodes.length !== 1) return;
          const [node] = nodes;
          const DOMNode = editor.getElementByKey(node.__key);
          const EditorNode = editor.getRootElement();
          console.log("DOMNODE", DOMNode, EditorNode);
          if (!DOMNode || !EditorNode) return;
          const editorRect = EditorNode.getBoundingClientRect();
          const nodeRect = DOMNode.getBoundingClientRect();
          setState(nodeRect.y + nodeRect.height - editorRect.y + 8);
        }
      });
    } else {
      setState(0);
    }
  }, [query, queryType]);

  React.useEffect(() => {
    if (!query && !queryType) return;
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
  }, [query, queryType]);

  const escape = () => {
    setQuery("");
    setQueryType(null);
    push((prev) => {
      if (!prev) {
        return [];
      }
      if (isNoop(prev)) {
        return [prev];
      }
      return [prev, [{ index: 0 }]];
    });
  };

  const reset = () => {
    setQuery("");
    setQueryType(null);
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

  const insertBlock = async (insert: EditorComputation) => {
    const success = await new Promise<boolean>((resolve) => {
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

          node.spliceText(
            selection.anchor.offset - query.length,
            query.length,
            "",
            true
          );

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

    if (success) {
      setQuery("");
      setQueryType(null);
    }
  };

  const insertComputation = async (
    insert: EditorComputation,
    removeExtra?: boolean
  ) => {
    const success = await new Promise<boolean>((resolve) => {
      editor.update(
        () => {
          const selection = $getSelection();

          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            resolve(false);
            return;
          }

          const anchor = selection.anchor;
          let node = anchor.getNode();
          const index = $getIndexFromPoint(anchor);

          if (!$isTextNode(node) || index === null) {
            resolve(false);
            return;
          }

          const remove = query.length;
          const startIndex = anchor.offset - remove;
          const universalIndex = $getIndexFromPoint(anchor) - remove;

          if (insert.length === 1 && typeof insert[0] === "string") {
            node = node.spliceText(startIndex, remove, insert[0], true);
            if (node.getTextContent() === "") {
              node.remove();
            }
          } else {
            try {
              spliceTextWithNodes(
                node,
                startIndex,
                remove,
                getNodesFromComputation(insert, libraries)
              );
            } catch (err) {
              console.error(err);
              resolve(false);
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

    if (success) {
      setQuery("");
      setQueryType(null);
    }
  };

  const func = functions.includes(queryString as any);

  const show = queryType || func;

  const QueryIcon = {
    "": null,
    "#": HashtagIcon,
    "<": ChevronLeftIcon,
    "@": AtSymbolIcon,
    "/": LinkIcon,
    ".": PhotoIcon,
  }[queryType ?? ""];

  const queryTitle = {
    "": null,
    "#": "Indsæt farve",
    "<": "Indsæt element",
    ".": "Find billede",
    "@": "Opslag",
    "/": "Generer linkadresse",
  }[queryType ?? ""];

  return (
    <>
      <div
        className={cl(
          "absolute left-11 right-11 z-10 bg-gray-800 p-2 rounded shadow-lg font-light",
          show
            ? "opacity-100 transition-opacity"
            : "opacity-0 pointer-events-none"
        )}
        style={{ transform: `translate(0px, ${y}px)` }}
      >
        <div className="flex flex-col gap-1">
          <div
            className={cl(
              "relative h-10 px-3 text-opacity-50 text-gray-300 text-xs flex items-center rounded"
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
          {queryType === "<" && (
            <QueryComponents
              selected={selected}
              query={queryString}
              insertBlock={insertBlock}
              options={options}
            />
          )}
          {queryType === "@" && (
            <QueryCommands
              selected={selected}
              query={queryString}
              insertBlock={insertBlock}
            />
          )}
          {queryType === "/" && (
            <QueryLinks
              selected={selected}
              query={queryString}
              insertComputation={insertComputation}
            />
          )}
          {queryType === "." && (
            <QueryFiles
              selected={selected}
              query={queryString}
              reset={reset}
              holdActions={holdActions}
              insertComputation={insertComputation}
            />
          )}
          {!queryType && func && (
            <Option isSelected={true} onEnter={() => {}} Icon={BoltIcon}>
              Indsæt funktion: "{queryString}()"
            </Option>
          )}
        </div>
      </div>
      {React.useMemo(() => children(pushWithQuery), [pushWithQuery])}
    </>
  );
}

function useOnEnter(callback: () => void, deps: any[]) {
  const editor = useEditorContext();

  React.useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (ev) => {
        ev?.preventDefault();
        callback();
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, deps);
}

function QueryComponents({
  query,
  selected,
  insertBlock,
  options: defaultOptions,
}: {
  query: string;
  selected: number;
  insertBlock: (comp: EditorComputation) => void;
  options?: string[];
}) {
  const { libraries } = useClientConfig();
  let options = libraries
    .map((library) =>
      Object.values(library.components).map((component) => ({
        ...component,
        libraryName: library.name,
        libraryLabel: library.label,
      }))
    )
    .flat(1);

  if (defaultOptions) {
    options = options.filter((el) =>
      defaultOptions.includes(`${el.libraryName}:${el.name}`)
    );
  } else {
    options = options.filter((el) => !el.hidden);
  }

  const filtered = query
    ? options.filter(({ label }) =>
        label.toLowerCase().startsWith(query.toLowerCase())
      )
    : options;

  const current = selected < 0 ? selected : selected % filtered.length;

  useOnEnter(() => {
    const config = filtered[current];
    if (config) {
      insertBlock([
        createComponent(config.name, {
          library: config.libraryName,
          libraries,
        }),
      ]);
    }
  }, [query, selected]);

  return (
    <>
      {filtered.map((el, index) => (
        <Option
          key={el.name}
          onEnter={() => {
            insertBlock([
              createComponent(el.name, { library: el.libraryName, libraries }),
            ]);
          }}
          isSelected={index === current}
          Icon={CubeIcon}
          secondaryText={markMatchingString(el.name, query)}
        >
          {markMatchingString(el.label, query)}
        </Option>
      ))}
    </>
  );
}

const markMatchingString = (string: string, query: string): React.ReactNode => {
  let i = 0;
  let stringLower = string.toLowerCase();
  let queryLower = query.toLowerCase();
  while (stringLower[i] === queryLower[i]) {
    i++;
    if (i >= string.length || i >= query.length) {
      break;
    }
  }

  return i > 0 ? (
    <>
      <strong className="whitespace-pre">{string.substring(0, i)}</strong>
      <span className="whitespace-pre opacity-80">{string.substring(i)}</span>
    </>
  ) : (
    <span className="whitespace-pre opacity-80">{string}</span>
  );
};

function QueryCommands({
  query,
  selected,
  insertBlock,
}: {
  query: string;
  selected: number;
  insertBlock: (comp: EditorComputation) => void;
}) {
  const searchQuery = query.match(/\"([^\"]*)/)?.[1] ?? query;

  const [isSearching, setIsSearching] = React.useState(false);

  const { data } = SWRClient.articles.getByLabel.useQuery(searchQuery, {
    inactive: !isSearching,
  });

  let options: any[] = [];

  if (!isSearching) {
    options = [
      {
        id: 0,
        label: (
          <div className="flex items-center">
            {markMatchingString("Søg efter dokument", query)}
            {/*<EllipsisHorizontalIcon className="w-4 h-4 opacity-75" />*/}
          </div>
        ),
        secondary: `"${searchQuery.substring(0, 20)}${
          searchQuery.length > 20 ? " ..." : ""
        }"`,
        onEnter() {
          setIsSearching(true);
        },
        onEnterLabel: "Slå op",
        Icon: MagnifyingGlassIcon,
      },
      {
        id: 1,
        label: (
          <div className="flex items-center">
            {markMatchingString("AI-kommando", query)}
          </div>
        ),
        onEnter() {
          console.log("BIP BOP");
        },
        onEnterLabel: "Slå op",
        Icon: RocketLaunchIcon,
        secondary: `"${searchQuery.substring(0, 20)}${
          searchQuery.length > 20 ? " ..." : ""
        }"`,
      },
    ];
  } else {
    options = (data ?? []).map((el) => ({
      id: el.id,
      label: el.values[LABEL_ID],
      secondary: el.id,
      Icon: DocumentIcon,
      onEnter() {
        insertBlock([{ dref: el.id }]);
      },
      onEnterLabel: "Tilføj",
      onArrowRight() {},
      onArrowRightLabel: "Se felter",
    }));
  }

  const current = selected < 0 ? selected : selected % options.length;

  useOnEnter(() => {
    options[current]?.onEnter();
  }, [options, query, selected]);

  return (
    <>
      {options.map((el, index) => (
        <Option
          key={el.id}
          onEnter={el.onEnter}
          onEnterLabel={el.onEnterLabel}
          onArrowRight={el.onArrowRight}
          onArrowRightLabel={el.onArrowRightLabel}
          isSelected={index === current}
          secondaryText={el.secondary}
          Icon={el.Icon}
        >
          {el.label}
        </Option>
      ))}
    </>
  );
}

function QueryLinks({
  query,
  selected,
  insertComputation,
}: {
  query: string;
  selected: number;
  insertComputation: (insert: EditorComputation, removeExtra?: boolean) => void;
}) {
  const editor = useEditorContext();

  const getPrevSymbol = () => {
    return editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
      const index = $getIndexFromPoint(selection.anchor) - (query.length + 1);
      if (index === 0) return;
      const computation = $getComputation($getRoot());
      return tools.at(computation, index - 1);
    });
  };

  const [linkParent, setLinkParent] = React.useState<FieldImport | null>(null);

  const [parentUrl] = useGlobalState<Value[]>(linkParent?.fref);

  React.useEffect(() => {
    const symbol = getPrevSymbol();
    if (tools.isImport(symbol, "field")) {
      setLinkParent(symbol);
    }
  }, []);

  const fullQuery = parentUrl?.[0] ? `${parentUrl[0]}/${query}` : query;

  let options: any[] = [];

  const apps = useAppFolders();

  const [app, setApp] = React.useState(
    apps?.length === 1 ? apps[0].id : undefined
  );

  const { data: list } = SWRClient.articles.getList.useQuery(app as string, {
    inactive: !app,
  });

  if (!app) {
    options =
      apps?.map((el) => ({
        id: el.id,
        label: el.label,
        // secondaryText: "Vis links",
        Icon: ComputerDesktopIcon,
        onEnter() {
          setApp(el.id);
        },
        onEnterLabel: "Vis links",
      })) ?? [];
  } else if (list) {
    options = list.articles.reduce((acc, el) => {
      const url = (el.values[URL_ID]?.[0] as string) || "";
      if (url.startsWith(fullQuery.toLowerCase())) {
        acc.push({
          id: el.id,
          label: markMatchingString(url, fullQuery) || "[forside]",
          onEnterLabel: "Indsæt",
          // secondaryText: "Vis links",
          Icon: LinkIcon,
          onEnter() {
            const fieldImport: FieldImport = {
              id: createId(1),
              fref: computeFieldId(el.id, URL_ID),
              args: {},
            };
            insertComputation([fieldImport], Boolean(parentUrl));
          },
        });
        return acc;
      }
      return acc;
    }, [] as any[]);
  }

  const current = selected < 0 ? selected : selected % options.length;

  useOnEnter(() => {
    const option = options[current];
    if (option) {
      option.onEnter();
    }
  }, [query, selected]);

  if (list) {
  }

  return (
    <>
      {options.map(
        ({ id, label, secondaryText, Icon, onEnter, onEnterLabel }, index) => (
          <Option
            onEnter={onEnter}
            onEnterLabel={onEnterLabel}
            isSelected={index === current}
            secondaryText={secondaryText}
            Icon={Icon}
          >
            {label}
          </Option>
        )
      )}
    </>
  );
}

function useFileInput(setLabel?: (label: string) => void) {
  const [dragging, setDragging] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<null | File>(null);

  const state = {
    file,
    preview,
  };

  const enteredElement = React.useRef<HTMLLabelElement | null>(null);

  const setFileOnUpload = async (newFile: File) => {
    const type = getFileType(newFile.type);
    if (type === null) return;
    if (["image", "video"].includes(type)) {
      setPreview(URL.createObjectURL(newFile));
    }
    setLabel?.(newFile.name.replace(/(.*)\.[^.]+$/, "$1"));
    setFile(newFile);
  };

  const onChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = ev.target.files?.[0] ?? null;
    if (newFile) {
      setFileOnUpload(newFile);
    }
  };

  const onDragOver = (ev: React.DragEvent<HTMLLabelElement>) => {
    if (ev.dataTransfer.types.includes("Files")) {
      enteredElement.current = ev.currentTarget;
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  const onDrop = (ev: React.DragEvent<HTMLLabelElement>) => {
    if (ev.dataTransfer.types.includes("Files")) {
      ev.preventDefault();
      ev.stopPropagation();
      setDragging(false);
      const newFile = ev.dataTransfer.files?.[0];
      if (newFile) setFileOnUpload(newFile);
    }
  };

  const onDragEnter = (ev: React.DragEvent<HTMLLabelElement>) => {
    if (ev.dataTransfer.types.includes("Files")) {
      ev.preventDefault();
      ev.stopPropagation();
      setDragging(true);
    }
  };

  const onDragLeave = (ev: React.DragEvent<HTMLLabelElement>) => {
    if (ev.dataTransfer.types.includes("Files")) {
      ev.preventDefault();
      ev.stopPropagation();
      if (enteredElement.current === ev.target) {
        setDragging(false);
        enteredElement.current = null;
      }
    }
  };

  const resetFile = () => {
    setFile(null);
    setPreview(null);
    setLabel?.("");
  };

  const actions = {
    onChange,
    dragEvents: {
      onDragOver,
      onDrop,
      onDragEnter,
      onDragLeave,
    },
    resetFile,
  };

  return [state, actions] as [typeof state, typeof actions];
}

function QueryFiles({
  query,
  selected,
  reset,
  holdActions,
  insertComputation,
}: {
  query: string;
  selected: number;
  reset: () => void;

  holdActions: {
    hold: () => void;
    restore: () => void;
  };
  insertComputation: (computation: EditorComputation) => void;
}) {
  const slug = useOrganisationSlug();

  const searchQuery = query.match(/\"([^\"]*)/)?.[1] ?? query;

  const [files, upload] = useFiles();

  const [label, setLabel] = React.useState("");

  const [{ file, preview }, { onChange, dragEvents, resetFile }] = useFileInput(
    (label: string) => {
      if (!query) setLabel(label);
      holdActions.restore();
    }
  );

  const previewOption = preview ? 1 : 0;

  const optionsLength = files.length + 1 + previewOption;

  const current = selected < 0 ? selected : selected % optionsLength;

  useOnEnter(() => {
    const offset = 1 + previewOption;
    const option = files[offset + current];
    console.log("OPTION", option, files, offset, current);
    if (option) {
      insertComputation([[option.name as TokenString]]);
    }
  }, [query, files, previewOption, current]);

  const initialCurrent = React.useRef<number | null>(current);

  React.useEffect(() => {
    if (current !== initialCurrent.current) {
      const el = document.querySelector(`[data-image-preview="${current}"]`);
      if (el) el.scrollIntoView();
      initialCurrent.current = null; // stop blocking at initialCurrent
    }
  }, [current]);

  const [isUploading, setIsUploading] = React.useState(false);

  return (
    <div className="flex items-start gap-3 overflow-x-auto no-scrollbar p-[1px] -m-[1px]">
      <div className="shrink-0 flex flex-col">
        <label
          className={cl(
            "rounded bg-[#ffffff05] p-3 m-0 hover:bg-gray-700 transition-colors text-sm text-center w-52 shrink-0",
            current === 0 && "ring-1 ring-gray-700"
          )}
          data-image-preview="0"
          onMouseDown={(ev) => {
            ev.preventDefault();
          }}
          onClick={async (ev) => {
            if (preview) {
              ev.preventDefault();
              if (!file) return;
              const type = getFileType(file.type);
              if (!type) return;
              setIsUploading(true);
              let size: {
                width?: number;
                height?: number;
                size?: number;
              } | null = {
                size: file.size,
              };
              if (["image", "video"].includes(type)) {
                const measure = type === "image" ? getImageSize : getVideoSize;
                size = await measure(preview);
              }
              const name = await upload(file, query || label, size);
              resetFile();
              insertComputation([[name as TokenString]]);
              setIsUploading(false);
            } else {
              holdActions.hold();
            }
          }}
          {...dragEvents}
        >
          <input
            type="file"
            className="absolute w-0 h-0 opacity-0"
            onChange={onChange}
          />
          <div className="relative w-full aspect-[4/3] flex-center mb-2">
            {preview ? (
              <img
                src={preview}
                className="max-w-full max-h-full w-auto h-auto"
              />
            ) : (
              <span className="text-gray-300 text-opacity-75">Tilføj fil</span>
            )}

            <div
              className={cl(
                "absolute inset-0 bg-black/50 flex-center transition-opacity",
                isUploading ? "opacity-100" : "opacity-0"
              )}
            >
              {isUploading && <Spinner />}
            </div>
          </div>
          <div className="truncate w-full">
            {query || label || "Ingen label"}
          </div>
        </label>
        {preview && (
          <div className="flex gap-2 w-full">
            <button
              className={cl(
                "grow shrink basis-0 bg-[#ffffff05] mt-2 px-3 py-1.5 rounded flex-center hover:bg-gray-700 text-gray-300 text-opacity-75 text-sm",
                current === 1 && "ring-1 ring-gray-700"
              )}
              data-image-preview="1"
              onMouseDown={(ev) => {
                ev.preventDefault();
              }}
              onClick={() => {
                resetFile();
              }}
            >
              Kasser
            </button>
          </div>
        )}
      </div>
      {files.map(({ name, label }, index) => (
        <div
          className={cl(
            "rounded bg-[#ffffff05] p-3 hover:bg-gray-700 transition-colors text-sm text-center w-52 shrink-0",
            current === index + 1 + previewOption && "ring-1 ring-gray-700"
          )}
          onMouseDown={(ev) => {
            ev.preventDefault();
            insertComputation([[name as TokenString]]);
          }}
          data-image-preview={`${index + 1 + previewOption}`}
        >
          <div className="w-full aspect-[4/3] flex-center mb-2">
            <img
              src={`https://awss3stack-mybucket15d133bf-1wx5fzxzweii4.s3.eu-west-1.amazonaws.com/${slug}/${name}`}
              className="max-w-full max-h-full w-auto h-auto"
            />
          </div>
          <div className="truncate w-full">{label}</div>
        </div>
      ))}
    </div>
  );
}

function Option({
  isSelected,
  onEnter,
  onEnterLabel,
  onArrowRight,
  onArrowRightLabel,
  children,
  secondaryText,
  Icon,
}: {
  isSelected: boolean;
  onEnter: () => void;
  onEnterLabel?: string;
  onArrowRight?: () => void;
  onArrowRightLabel?: string;
  children: React.ReactNode;
  secondaryText?: React.ReactNode;
  Icon?: React.FC<any>;
}) {
  return (
    <div
      className={cl(
        "group pl-3 pr-2 h-10 rounded text-sm hover:bg-gray-700 transition-colors",
        isSelected && "ring-1 ring-gray-700",
        "flex items-center justify-between"
      )}
      onMouseDown={(ev) => {
        ev.preventDefault();
      }}
      onClick={onEnter}
    >
      <div className="flex gap-3 items-center text-white text-opacity-90">
        <div>{Icon && <Icon className="w-4 h-4" />}</div>{" "}
        <div>
          {children}
          {secondaryText && (
            <div className="text-xs text-gray-300 text-opacity-75 -mt-0.5">
              {secondaryText}
            </div>
          )}
        </div>
      </div>
      {isSelected && (
        <div className="flex">
          {onArrowRight && (
            <button
              className={cl(
                "text-gray-300 text-opacity-50 text-xs flex gap-2 py-1.5 px-3 rounded",
                "peer hover:bg-gray-600 transition-colors"
              )}
            >
              {onArrowRightLabel ?? "indsæt"}
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          )}
          <button
            className={cl(
              "text-gray-300 text-opacity-50 text-xs flex gap-2 py-1.5 px-3 rounded",
              onArrowRight &&
                "group-hover:bg-gray-600 peer-hover:bg-transparent transition-colors"
            )}
          >
            {onEnterLabel ?? "indsæt"}
            <ArrowUturnRightIcon className="w-4 h-4 rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
}
