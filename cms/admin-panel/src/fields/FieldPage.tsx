import {
  createEventsFromCMSToIframe,
  createEventsFromIframeToCMS,
} from "@storyflow/frontend/events";
import cl from "clsx";
import React from "react";
import { calculateFn } from "./default/calculateFn";
import { tools } from "shared/editor-tools";
import { store, useGlobalState } from "../state/state";
import {
  DocumentId,
  FieldId,
  SyntaxTreeRecord,
  SyntaxTree,
  ValueArray,
  ClientSyntaxTree,
  NestedDocumentId,
  NestedField,
} from "@storyflow/backend/types";
import { extendPath } from "@storyflow/backend/extendPath";
import Content from "../layout/components/Content";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useClientConfig } from "../client-config";
import { createComponent } from "./Editor/createComponent";
import { useDocumentMutate } from "../documents/collab/DocumentCollabContext";
import { useDocumentPageContext } from "../documents/DocumentPageContext";
import { Client, useClient } from "../client";
import {
  computeFieldId,
  getDocumentId,
  getIdFromString,
  getRawDocumentId,
  getRawFieldId,
} from "@storyflow/backend/ids";
import { ComponentConfig, LibraryConfig } from "@storyflow/frontend/types";
import { useDocumentIdGenerator } from "../id-generator";
import { tokens } from "@storyflow/backend/tokens";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";
import { createTokenStream } from "shared/parse-token-stream";
import {
  Attributes,
  AttributesProvider,
  useAttributesContext,
} from "./Attributes";
import { createKey } from "../utils/createKey";
import { BuilderIframe } from "./builder/BuilderIframe";
import { SelectedPathProvider, SyncBuilderPath, useSelectedPath } from "./Path";
import { DefaultField } from "./default/DefaultField";
import { FieldIdContext } from "./FieldIdContext";
import { EditorFocusProvider } from "../editor/react/useIsFocused";
import { useRoute } from "../panel-router/Routes";
import { parseSegment } from "../layout/components/routes";
import { splitStreamByBlocks } from "./Editor/transforms";
import { FieldOperation } from "shared/operations";

const useBuilderRendered = ({
  listeners,
}: {
  listeners: ReturnType<typeof createEventsFromIframeToCMS>;
}) => {
  const [rendered, setRendered] = React.useState<boolean>(false);

  React.useLayoutEffect(() => {
    return listeners.rendered.subscribe((config) => {
      setRendered(true);
    });
  }, []);

  React.useLayoutEffect(() => {
    return listeners.unrendered.subscribe(() => {
      setRendered(false);
    });
  }, []);

  return rendered;
};

const ElementActions = ({
  id,
  listeners,
  push,
}: {
  id: FieldId;
  listeners: ReturnType<typeof createEventsFromIframeToCMS>;
  push: (op: FieldOperation) => void;
}) => {
  const [{ selectedDocument, selectedField }, setBuilderPath] =
    useSelectedPath();

  const parentId = selectedField;
  const elementId = selectedDocument;

  const [tree] = useGlobalState<SyntaxTree>(
    selectedField ? `${selectedField}#tree` : undefined
  );

  const tokenStream = React.useMemo(() => {
    if (!tree) return;
    return createTokenStream(tree);
  }, [tree]);

  /*
  React.useEffect(() => {
    return listeners.selection.subscribe((path) => {
      console.log("PATH", path);
      const element = path[path.length - 1];
      const parentElementId = path[path.length - 2]?.id as NestedDocumentId;
      const parentId = parentElementId
        ? computeFieldId(
            parentElementId,
            getIdFromString((element as { parentProp: string }).parentProp)
          )
        : element.id
        ? id
        : undefined;
      console.log("PARENT", element.id, parentId);
      setPath({
        elementId: element.id as NestedDocumentId,
        parentId,
      });
    });
  }, [id]);
  */

  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const { libraries } = useClientConfig();
  React.useEffect(() => {
    return listeners.createComponent.subscribe(({ path, name, library }) => {
      push([
        path.split(".").slice(-1)[0],
        [
          {
            index: 0,
            insert: [
              createComponent(generateDocumentId(documentId), name, {
                library,
                libraries,
              }),
            ],
          },
        ],
      ]);
    });
  }, [libraries, generateDocumentId]);

  React.useEffect(() => {
    return listeners.changeComponent.subscribe(({ library, name }) => {
      if (!tokenStream || !parentId || !elementId) return;

      let index = -1;
      tools.forEach(
        tokenStream,
        (value, i) => {
          if (tokens.isNestedElement(value) && value.id === elementId) {
            index = i;
            return true;
          }
        },
        true
      );

      console.log("CHANGE", tokenStream, index, parentId, library, name);

      if (index < 0) return;

      push([
        parentId === id ? "" : parentId,
        [
          {
            index,
            insert: [
              createComponent(generateDocumentId(documentId), name, {
                library,
                libraries,
              }),
            ],
            remove: 1,
          },
        ],
      ]);
    });
  }, [id, libraries, tokenStream, parentId, elementId, generateDocumentId]);

  React.useEffect(() => {
    return listeners.deleteComponent.subscribe(() => {
      if (!tokenStream || !parentId || !elementId) return;

      let index = -1;
      tools.forEach(
        tokenStream,
        (value, i) => {
          if (tokens.isNestedElement(value) && value.id === elementId) {
            index = i;
            return true;
          }
        },
        true
      );

      if (index < 0) return;

      push([
        parentId === id ? "" : parentId,
        [
          {
            index,
            remove: 1,
          },
        ],
      ]);

      setBuilderPath((ps) => ps.slice(0, -1));
    });
  }, [id, libraries, tokenStream, parentId, elementId]);

  React.useEffect(() => {
    return listeners.moveComponent.subscribe(({ parent, from, to }) => {
      console.log("MOVE", parent, from, to, tokenStream);
      if (!tokenStream || !parentId) return;
      const blocks = splitStreamByBlocks(tokenStream, libraries);

      let length = 0;
      let fromIndex = 0;
      let toIndex = 0;

      let index = 0;
      blocks.forEach((el) => {
        if (index < from) {
          fromIndex += tools.getLength(el);
        }
        if (index < to) {
          toIndex += tools.getLength(el);
        }
        /*
        if (to > from && index === to) {
          toIndex += tools.getLength(el) - 1;
        }
        */
        if (index === from) {
          length = tools.getLength(el);
        }
        if (
          !tokens.isLineBreak(el[0]) ||
          index === blocks.length - 1 ||
          tokens.isLineBreak(blocks[index + 1]?.[0])
        ) {
          // increase index only if it is a rendered block
          index++;
        }
      });

      /*
      let fromIndex: number | null = null;
      let toIndex: number | null = null;

      tools.forEach(
        tokenStream,
        (value, index) => {
          if (tokens.isNestedElement(value)) {
            i++;
          }
          if (fromIndex === null && i === from) {
            fromIndex = index;
          }
          if (toIndex === null && i === to) {
            toIndex = index;
          }
          if (fromIndex !== null && toIndex !== null) {
            return true;
          }
        },
        true
      );

      if (fromIndex === null || toIndex === null) {
        return;
      }
      */

      push([
        parentId === id ? "" : parentId,
        [
          {
            index: fromIndex,
            remove: length,
          },
          {
            index: toIndex,
          },
        ],
      ]);
    });
  }, [id, tokenStream, parentId, libraries]);

  return null;
};

const useIframe = () => {
  const [uniqueId] = React.useState(() => createKey());
  const [iframe, setIframe] = React.useState<HTMLIFrameElement>();

  const listeners = React.useMemo(() => {
    const events = createEventsFromIframeToCMS();
    events.setTarget(uniqueId);
    return events;
  }, []);

  const dispatchers = React.useMemo(() => {
    const events = createEventsFromCMSToIframe();
    events.setTarget(uniqueId);
    return events;
  }, []);

  const ref = React.useCallback((node: HTMLIFrameElement) => {
    if (node) {
      setIframe(node);
      dispatchers.setTarget(uniqueId, node.contentWindow);
    }
  }, []);

  React.useLayoutEffect(() => {
    if (iframe) {
      return listeners.updateFrameHeight.subscribe((height) => {
        iframe.style.height = `${height}px`;
      });
    }
  }, [iframe]);

  const ctx = React.useMemo(
    () => ({
      iframeProps: {
        uniqueId,
        ref,
      },
      listeners,
      dispatchers,
    }),
    []
  );

  return ctx;
};

export function FieldPage({ children }: { children?: React.ReactNode }) {
  const route = useRoute();
  const segment = parseSegment<"field">(route);
  const id = segment.id;

  const documentId = getDocumentId(id);
  const templateFieldId = getRawFieldId(id);

  const { iframeProps, listeners, dispatchers } = useIframe();

  const rendered = useBuilderRendered({ listeners });

  const { push } = useDocumentMutate<FieldOperation>(
    documentId,
    templateFieldId
  );

  return (
    <FieldIdContext.Provider value={id}>
      <AttributesProvider>
        <SelectedPathProvider
          id={id}
          onChange={(path) => {
            // dispatch
          }}
        >
          <SyncBuilderPath listeners={listeners} id={id} />
          <ElementActions id={id} listeners={listeners} push={push} />
          <Content className="relative h-full">
            <PropagateStatePlugin
              id={id}
              rendered={rendered}
              dispatchers={dispatchers}
            />
            <PanelGroup direction="horizontal" autoSaveId="panels">
              <Panel collapsible>
                <div className="relative h-full bg-gray-200">
                  <div
                    className={cl(
                      "h-full transition-opacity duration-300",
                      rendered ? "opacity-100" : "opacity-0"
                    )}
                  >
                    <BuilderIframe
                      {...iframeProps}
                      heightListener={listeners.updateFrameHeight.subscribe}
                    />
                  </div>
                  <FieldOverlay id={id} />
                </div>
              </Panel>
              <PanelResizeHandle
                className={cl(
                  "group relative bg-white/10 opacity-50 hover:opacity-100 transition-opacity",
                  "w-1"
                )}
              />
              <Panel collapsible>
                <div className="p-2.5 h-full overflow-y-auto overflow-x-hidden no-scrollbar">
                  <FieldPanel id={id} />
                </div>
              </Panel>
            </PanelGroup>
          </Content>
          {children}
        </SelectedPathProvider>
      </AttributesProvider>
    </FieldIdContext.Provider>
  );
}

function FieldPanel({ id }: { id: FieldId }) {
  const [{ selectedField = id }] = useSelectedPath();

  return (
    <EditorFocusProvider>
      <DefaultField key={selectedField} id={selectedField} />
    </EditorFocusProvider>
  );
}

function FieldOverlay({ id }: { id: FieldId }) {
  const [currentId] = useAttributesContext();

  return (
    <EditorFocusProvider>
      <div
        className={cl(
          "absolute max-h-[calc(100%-1.25rem)] min-h-[5.25rem] bg-gray-850 shadow-lg shadow-black/20 w-[calc(100%-1.25rem)] rounded-md bottom-2.5 left-2.5 overflow-y-auto no-scrollbar transition-[transform,opacity] ease-out duration-200 origin-bottom",
          !currentId
            ? "opacity-0 pointer-events-none scale-[0.98]"
            : "opacity-100 scale-100"
        )}
      >
        <div className={cl("relative grow shrink basis-0 p-2.5")}>
          <div className="flex items-center text-sm gap-2 mb-2.5">
            <Attributes hideChildrenProps />
          </div>
          {/* we assume queue has been initialized by previous page, so no need for root */}
          {currentId && <DefaultField key={currentId} id={currentId} />}
        </div>
      </div>
    </EditorFocusProvider>
  );
}

export type ValueRecord = Record<string, ValueArray | ClientSyntaxTree>;

const getRecordSnapshot = (
  entry: FieldId,
  {
    record = {},
    client,
    libraries,
  }: {
    record?: SyntaxTreeRecord;
    client: Client;
    libraries: LibraryConfig[];
  }
) => {
  const finalRecord: ValueRecord = {};

  const recursivelyGetRecordFromComputation = (fieldId: FieldId) => {
    const state = store.use<ValueArray | ClientSyntaxTree>(fieldId);

    if (!state.initialized()) {
      const initialValue = record[fieldId] ?? DEFAULT_SYNTAX_TREE;
      state.set(() =>
        calculateFn(initialValue, {
          record,
          client,
          documentId: getDocumentId(entry),
        })
      );
    }

    const value = state.value!;

    const getChildren = (value: ValueArray | ClientSyntaxTree): {} => {
      let array: ValueArray = [];

      if (!Array.isArray(value)) {
        const traverseNode = (node: ClientSyntaxTree) => {
          node.children.forEach((el) => {
            if (Array.isArray(el)) {
              el.forEach((token) => {
                if (tokens.isNestedElement(token)) {
                  array.push(token);
                }
              });
            } else {
              traverseNode(el);
            }
          });
        };

        traverseNode(value);
      } else {
        array = value;
      }

      return array.reduce((acc, element) => {
        if (Array.isArray(element)) {
          // this should propably just flat it infinitely out
          return Object.assign(acc, getChildren(element));
        } else if (tokens.isNestedElement(element)) {
          const components = libraries
            .reduce(
              (acc: ComponentConfig[], library) =>
                acc.concat(
                  Object.values(library.components).map((el) => ({
                    ...el,
                    name: extendPath(library.name, el.name, ":"),
                  }))
                ),
              []
            )
            .flat(1);

          const propConfigArray = components.find(
            (el) => el.name === element.element
          )?.props;

          const propKeys =
            propConfigArray?.reduce((acc: string[], el) => {
              if (el.type === "group") {
                acc.push(
                  ...el.props.map((child) => `${el.name}#${child.name}`)
                );
                return acc;
              }
              acc.push(el.name);
              return acc;
            }, []) ?? [];

          propKeys.push("key");

          const props = propKeys.reduce((acc, key) => {
            return Object.assign(
              acc,
              recursivelyGetRecordFromComputation(
                computeFieldId(element.id, getIdFromString(key))
              )
            );
          }, {});

          return Object.assign(acc, props);
        } else {
          return acc;
        }
      }, {});
    };

    const children = getChildren(value);

    Object.assign(finalRecord, {
      [fieldId]: value,
      ...children,
    });
  };

  recursivelyGetRecordFromComputation(entry);

  return finalRecord;
};

function PropagateStatePlugin({
  id,
  rendered,
  dispatchers,
}: {
  id: FieldId;
  rendered: boolean;
  dispatchers: ReturnType<typeof createEventsFromCMSToIframe>;
}) {
  const { record } = useDocumentPageContext();

  const client = useClient();

  const { libraries } = useClientConfig();

  // state initialized in ComponentField
  const [tree, setTree] = useGlobalState<ValueRecord>(`${id}/record`, () => {
    return getRecordSnapshot(id, {
      record,
      client,
      libraries,
    });
  });

  let oldValue = React.useRef({ ...tree });

  React.useEffect(() => {
    if (rendered) {
      const record = store.use<ValueRecord>(`${id}/record`).value;
      if (record) {
        dispatchers.initialize.dispatch({
          id,
          record,
        });
      }
    }
  }, [rendered]);

  React.useEffect(() => {
    if (rendered && tree) {
      const updateEntries = Object.entries(tree).filter(([key, value]) => {
        return !(key in oldValue.current) || oldValue.current[key] !== value;
      });
      if (updateEntries.length) {
        const updates = Object.fromEntries(updateEntries);
        dispatchers.update.dispatch(updates);
      }
    }
  }, [rendered, tree]);

  React.useEffect(() => {
    oldValue.current = { ...tree };
  }, [tree]);

  return null;
}
