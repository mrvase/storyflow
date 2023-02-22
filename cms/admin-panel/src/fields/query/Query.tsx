import cl from "clsx";
import {
  DocumentId,
  EditorComputation,
  FieldId,
  FieldImport,
  functions,
  Value,
} from "@storyflow/backend/types";
import { LABEL_ID, URL_ID } from "@storyflow/backend/templates";
import { computeFieldId, createId } from "@storyflow/backend/ids";
import {
  ArrowUturnRightIcon,
  AtSymbolIcon,
  BoltIcon,
  CalculatorIcon,
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
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  BLUR_COMMAND,
  CLICK_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  LexicalEditor,
  LexicalNode,
} from "lexical";
import React from "react";
import { useClientConfig } from "../../client-config";
import { SWRClient } from "../../client";
import { $isImportNode } from "../decorators/ImportNode";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import { useAppFolders } from "../../folders";
import { tools } from "shared/editor-tools";
import { ComputationOp } from "shared/operations";
import { useGlobalState } from "../../state/state";
import {
  getFileExtension,
  getFileType,
  getFileTypeFromExtension,
  getImageSize,
  getVideoSize,
} from "../../utils/file";
import { spliceTextWithNodes } from "../Editor/spliceTextWithNodes";
import { createComponent } from "../Editor/createComponent";
import {
  $getComputation,
  $getIndexFromPoint,
  $getNodeFromIndex,
  $isBlockNode,
  getNodesFromComputation,
} from "../Editor/transforms";
import { useFiles } from "../../files";
import { Spinner } from "../../elements/Spinner";
import { useUrlInfo } from "../../users";
import { LibraryConfig, RegularOptions } from "@storyflow/frontend/types";
import { useIsFocused } from "../../editor/react/useIsFocused";
import { useRestorableSelection } from "./useRestorableSelection";
import { useSelectedToken } from "./useSelectedToken";
import { useYPosition } from "./useYPosition";
import { QueryType, isAdjacent, isTextInsert, getQueryType } from "./helpers";
import { useFieldOptions } from "../default/OptionsContext";
import { ColorPicker } from "../../elements/ColorPicker/ColorPicker";
import useSWR from "swr";
import { getColorName } from "../../utils/colors";
import { Option } from "./Option";

export type TextOps = [{ index: number; insert: [string]; remove?: 0 }];

const insertComputation = async (
  editor: LexicalEditor,
  insert: EditorComputation,
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
  insert: EditorComputation,
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

const getOptionLabel = (option: RegularOptions[number]) => {
  return typeof option === "object"
    ? option.label ?? ("value" in option ? option.value : option.name)
    : option;
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

  const [queryType, setQueryType] = React.useState<QueryType | null>(null);
  const [query, setQuery] = React.useState("");

  const [token, setToken] = useSelectedToken(() => {});

  const isFocused = useIsFocused(editor);

  React.useEffect(() => {
    if (token)
      if ("src" in token) {
        setQueryType(".");
      } else if ("color" in token) {
        setQueryType("#");
      } else {
        setQueryType(null);
      }
  }, [token]);

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
          const queryType = getQueryType(query, index);
          console.log("QUERY", query, queryType);
          setQueryType(queryType);
        } else {
          setQuery("");
          setQueryType(null);
          result.push(noop);
        }
        console.log("PUSH RESULT", ...result);
        return result;
      });
    },
    [push, queryType, options]
  );

  const [hold, holdActions] = useRestorableSelection();

  React.useEffect(() => {
    if (hold) return;
    return mergeRegister(
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          console.log("blur escape");
          escape();
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand(
        CLICK_COMMAND,
        () => {
          if (!token && !options) {
            console.log("click escape");
            escape();
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      )
    );
  }, [push, hold, token, options]);

  const [selected, setSelected] = React.useState(0);

  React.useEffect(() => {
    setSelected(0);
  }, [query, queryType]);

  const queryString =
    queryType && query.startsWith(queryType) ? query.slice(1) : query;
  const func = functions.includes(queryString as any);
  const showOptions = isFocused && options && options.length > 0;
  const show = Boolean(queryType || func || showOptions);

  React.useEffect(() => {
    if (!show) return;
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
  }, [show]);

  const escape = () => {
    console.log("@QUERY ESCAPE");
    setQuery("");
    setQueryType(null);
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
    console.log("@QUERY RESET");
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
    async (insert: EditorComputation, removeExtra?: boolean) => {
      const success = await insertComputation(
        editor,
        insert,
        query.length,
        libraries,
        removeExtra
      );
      if (success) {
        setQuery("");
        setQueryType(null);
      }
    },
    [editor, query, libraries]
  );

  const insertBlockSimple = React.useCallback(
    async (insert: EditorComputation) => {
      const success = await insertBlock(
        editor,
        insert,
        query.length,
        libraries
      );
      if (success) {
        setQuery("");
        setQueryType(null);
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
              />
            )}
            {queryType === "<" && (
              <QueryComponents
                selected={selected}
                query={queryString}
                insertBlock={insertBlockSimple}
                insertComputation={insertComputationSimple}
                options={options}
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
            {!queryType && func && (
              <Option
                value={func}
                isSelected={true}
                onEnter={() => {}}
                Icon={BoltIcon}
              >
                Indsæt funktion: "{queryString}()"
              </Option>
            )}
            {showOptions &&
              filteredOptions.map((option, i) => (
                <Option
                  value={option}
                  isSelected={selected === i}
                  onEnter={onOptionEnter}
                >
                  {getOptionLabel(option)}
                </Option>
              ))}
          </div>
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

function QueryColors({
  insertComputation,
  selected,
  setToken,
  initialColor,
}: any) {
  const [color, setColor] = React.useState(initialColor || "#ffffff");

  const { data } = useSWR("COLORS", {
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });

  let label = "";

  if (data) {
    label += getColorName(color.slice(1), data[0], data[1]);
  }

  const onEnter = React.useCallback((color: string) => {
    if (setToken) {
      setToken({ color });
    } else {
      insertComputation([{ color }]);
    }
  }, []);

  const current = selected < 0 ? selected : selected % 1;

  return (
    <>
      <div className="w-full flex mb-1 gap-2">
        <ColorPicker color={color} onChange={setColor} />
        <div
          className="grow-0 shrink-0 w-10 h-40 rounded"
          style={{ backgroundColor: color }}
        />
      </div>
      <Option
        value={color}
        onEnter={onEnter}
        isSelected={current === 0}
        Icon={CubeIcon}
        secondaryText={`${label} (${color})`}
      >
        Indsæt farve
      </Option>
      {/*<div className="flex justify-between text-gray-400 text-sm select-text">
        <span
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={() => {
            navigator.clipboard.writeText(label);
          }}
        >
          {label}
        </span>
        <span
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={() => {
            navigator.clipboard.writeText(color);
          }}
        >
          {color}
        </span>
        </div>*/}
    </>
  );
}

function QueryComponents({
  query,
  selected,
  insertBlock,
  insertComputation,
  options: optionsFromProps,
}: {
  query: string;
  selected: number;
  insertBlock: (comp: EditorComputation) => void;
  insertComputation: (comp: EditorComputation) => void;
  options?: RegularOptions;
}) {
  const defaultOptions = React.useMemo(() => {
    if (!optionsFromProps) return;

    const options = optionsFromProps.filter(
      (el) => typeof el === "object" && el.type === "element"
    ) as { type: "element"; name: string }[];
    return options.map((el) => el.name);
  }, [optionsFromProps]);

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

  const onEnter = React.useCallback(
    (config: (typeof filtered)[number]) => {
      if (config.inline) {
        insertComputation([
          createComponent(config.name, {
            library: config.libraryName,
            libraries,
          }),
        ]);
      } else {
        insertBlock([
          createComponent(config.name, {
            library: config.libraryName,
            libraries,
          }),
        ]);
      }
    },
    [insertComputation, insertBlock]
  );

  return (
    <>
      {filtered.map((el, index) => (
        <Option
          key={`${el.libraryName}:${el.name}`}
          value={el}
          onEnter={onEnter}
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

  const onSearchEnter = React.useCallback(() => setIsSearching(true), []);
  const onAIEnter = React.useCallback(() => console.log("BIP BOP"), []);

  const onEnter = React.useCallback(
    (id: DocumentId) => {
      () => {
        insertBlock([{ dref: id }]);
      };
    },
    [insertBlock]
  );

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
        onEnter: onSearchEnter,
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
        onEnter: onAIEnter,
        onEnterLabel: "Slå op",
        Icon: RocketLaunchIcon,
        secondary: `"${searchQuery.substring(0, 20)}${
          searchQuery.length > 20 ? " ..." : ""
        }"`,
      },
      {
        id: 2,
        label: (
          <div className="flex items-center">
            {markMatchingString("Skift mellem matematik/tekst", query)}
          </div>
        ),
        onEnter: onAIEnter,
        onEnterLabel: "Skift",
        Icon: CalculatorIcon,
      },
    ];
  } else {
    options = (data ?? []).map((el) => ({
      id: el.id,
      label: el.values[LABEL_ID],
      secondary: el.id,
      Icon: DocumentIcon,
      onEnter,
      onEnterLabel: "Tilføj",
      onArrowRight() {},
      onArrowRightLabel: "Se felter",
    }));
  }

  const current = selected < 0 ? selected : selected % options.length;

  return (
    <>
      {options.map((el, index) => (
        <Option
          key={el.id}
          value={el.id}
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
    if (tools.isFieldImport(symbol)) {
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

  const onAppEnter = React.useCallback((id: string) => {
    setApp(id);
  }, []);

  const onEnter = React.useCallback(
    (id: DocumentId) => {
      const fieldImport: FieldImport = {
        id: createId(1),
        fref: computeFieldId(id, URL_ID),
        args: {},
      };
      insertComputation([fieldImport], Boolean(parentUrl));
    },
    [parentUrl, query]
  );

  if (!app) {
    options =
      apps?.map((el) => ({
        id: el.id,
        label: el.label,
        // secondaryText: "Vis links",
        Icon: ComputerDesktopIcon,
        onEnter: onAppEnter,
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
          onEnter,
        });
        return acc;
      }
      return acc;
    }, [] as any[]);
  }

  const current = selected < 0 ? selected : selected % options.length;

  return (
    <>
      {options.map(
        ({ id, label, secondaryText, Icon, onEnter, onEnterLabel }, index) => (
          <Option
            value={id}
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
  const { organization } = useUrlInfo();

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
    if (option) {
      insertComputation([{ src: option.name }]);
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
              const src = await upload(file, query || label, size);
              if (!src) return;
              resetFile();
              setIsUploading(false);
              insertComputation([{ src }]);
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
        <FileContainer
          name={name}
          label={label}
          index={index + 1 + previewOption}
          isSelected={current === index + 1 + previewOption}
          organization={organization}
          insertComputation={insertComputation}
        />
      ))}
    </div>
  );
}

function FileContainer({
  isSelected,
  index,
  name,
  label,
  organization,
  insertComputation,
}: {
  isSelected: boolean;
  index: number;
  name: string;
  label: string;
  organization: string;
  insertComputation: (computation: EditorComputation) => void;
}) {
  return (
    <div
      className={cl(
        "rounded bg-[#ffffff05] p-3 hover:bg-gray-700 transition-colors text-sm text-center w-52 shrink-0",
        isSelected && "ring-1 ring-gray-700"
      )}
      onMouseDown={(ev) => {
        ev.preventDefault();
        insertComputation([{ src: name }]);
      }}
      data-image-preview={`${index}`}
    >
      <div className="w-full aspect-[4/3] flex-center mb-2">
        <File name={name} organization={organization} />
      </div>
      <div className="truncate w-full">{label}</div>
    </div>
  );
}

function File({ name, organization }: { name: string; organization: string }) {
  const type = getFileTypeFromExtension(getFileExtension(name) ?? "");
  const src = `https://awss3stack-mybucket15d133bf-1wx5fzxzweii4.s3.eu-west-1.amazonaws.com/${organization}/${name}`;
  return (
    <>
      {type === "image" && (
        <img src={src} className="max-w-full max-h-full w-auto h-auto" />
      )}
      {type === "video" && (
        <video
          style={{ width: "100%", height: "auto" }}
          autoPlay
          muted
          playsInline
          loop
        >
          <source src={src} id="video_here" />
          Your browser does not support HTML5 video.
        </video>
      )}
    </>
  );
}
