import {
  createEventsFromCMSToIframe,
  createEventsFromIframeToCMS,
} from "@storyflow/shared/events";
import cl from "clsx";
import React from "react";
import { tools } from "../operations/stream-methods";
import { store, useGlobalState } from "../state/state";
import {
  DocumentId,
  FieldId,
  ValueArray,
  ClientSyntaxTree,
} from "@storyflow/shared/types";
import type { SyntaxTree } from "@storyflow/cms/types";
import Content from "../pages/Content";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAppConfig } from "../AppConfigContext";
import { createComponent } from "./Editor/createComponent";
import { useDocumentPageContext } from "../documents/DocumentPageContext";
import { getDocumentId, getRawFieldId } from "@storyflow/cms/ids";
import { useDocumentIdGenerator } from "../id-generator";
import { tokens } from "@storyflow/cms/tokens";
import { createTokenStream } from "../operations/parse-token-stream";
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
import { splitStreamByBlocks } from "./Editor/transforms";
import { usePush } from "../collab/CollabContext";
import { FieldTransactionEntry } from "../operations/actions";
import { Transaction } from "@storyflow/collab/types";
import { createTransaction } from "@storyflow/collab/utils";
import { useRoute } from "@nanokit/router";
import { parseMatch } from "../layout/components/parseSegment";
import { getRecordSnapshot } from "./traverse";

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
  push: (op: Transaction<FieldTransactionEntry>) => void;
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

  const { configs } = useAppConfig();
  React.useEffect(() => {
    return listeners.createComponent.subscribe(({ path, name, library }) => {
      const target = path.split(".").slice(-1)[0] as FieldId;
      push(
        createTransaction((t) =>
          t.target(target).splice({
            index: 0,
            insert: [
              createComponent(generateDocumentId(documentId), name, {
                library,
                configs,
              }),
            ],
          })
        )
      );
    });
  }, [configs, generateDocumentId]);

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

      push(
        createTransaction((t) =>
          t.target(parentId).splice({
            index,
            insert: [
              createComponent(generateDocumentId(documentId), name, {
                library,
                configs,
              }),
            ],
            remove: 1,
          })
        )
      );
    });
  }, [id, configs, tokenStream, parentId, elementId, generateDocumentId]);

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

      push(
        createTransaction((t) =>
          t.target(parentId).splice({
            index,
            remove: 1,
          })
        )
      );

      setBuilderPath((ps) => ps.slice(0, -1));
    });
  }, [id, configs, tokenStream, parentId, elementId]);

  React.useEffect(() => {
    return listeners.moveComponent.subscribe(({ parent, from, to }) => {
      console.log("MOVE", parent, from, to, tokenStream);
      if (!tokenStream || !parentId) return;
      const blocks = splitStreamByBlocks(tokenStream, configs);

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

      push(
        createTransaction((t) =>
          t.target(parentId).splice(
            {
              index: fromIndex,
              remove: length,
            },
            {
              index: toIndex,
            }
          )
        )
      );
    });
  }, [id, tokenStream, parentId, configs]);

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
  const { id } = parseMatch<"field">(route);

  const documentId = getDocumentId<DocumentId>(id);
  const templateFieldId = getRawFieldId(id);

  const { iframeProps, listeners, dispatchers } = useIframe();

  const rendered = useBuilderRendered({ listeners });

  const push = usePush<FieldTransactionEntry>(documentId, templateFieldId);

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
              <Panel collapsible minSize={35} className="hidden @3xl:block">
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
          "absolute w-[calc(100%-1.25rem)] bottom-2.5 left-2.5",
          "transition-[transform,opacity] ease-out duration-200 origin-bottom",
          !currentId
            ? "opacity-0 pointer-events-none scale-[0.98]"
            : "opacity-100 scale-100"
        )}
      >
        <div
          className={cl(
            "w-full max-w-xl mx-auto max-h-[calc(100%-1.25rem)] bg-gray-850 shadow-lg shadow-black/20 rounded-md overflow-y-auto no-scrollbar"
          )}
        >
          <div
            className={cl(
              "relative grow shrink basis-0 p-2.5 pb-0.5 min-h-[4.75rem]"
            )}
          >
            <div className="flex items-center text-sm gap-2 mb-2.5">
              <Attributes hideChildrenProps />
            </div>
            {/* we assume queue has been initialized by previous page, so no need for root */}
            {currentId && <DefaultField key={currentId} id={currentId} />}
          </div>
        </div>
      </div>
    </EditorFocusProvider>
  );
}

export type ValueRecord = Record<string, ValueArray | ClientSyntaxTree>;

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

  const { configs } = useAppConfig();

  // state initialized in ComponentField
  const [tree] = useGlobalState(`${id}/record`, () => {
    const finalRecord: ValueRecord = {};

    getRecordSnapshot(
      id,
      (value, fieldId) => {
        finalRecord[fieldId] = value;
      },
      {
        record,
        configs,
      }
    );

    return finalRecord;
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
