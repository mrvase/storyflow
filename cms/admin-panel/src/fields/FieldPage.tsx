import {
  createEventsFromCMSToIframe,
  createEventsFromIframeToCMS,
} from "@storyflow/frontend/events";
import cl from "clsx";
import React from "react";
import BuilderIframe from "./builder/BuilderIframe";
import {
  useIframeDispatchers,
  useIframeListeners,
} from "./builder/IframeContext";
import { calculateFn } from "./default/calculateFn";
import { tools } from "shared/editor-tools";
import { ComputationOp, targetTools } from "shared/operations";
import { store, useGlobalState } from "../state/state";
import {
  DocumentId,
  TokenStream,
  FieldId,
  SyntaxTreeRecord,
  SyntaxTree,
  ValueArray,
  NestedDocumentId,
} from "@storyflow/backend/types";
import { extendPath } from "@storyflow/backend/extendPath";
import Content from "../layout/components/Content";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useLocalStorage } from "../state/useLocalStorage";
import { useClientConfig } from "../client-config";
import { createComponent } from "./Editor/createComponent";
import { useDocumentMutate } from "../documents/collab/DocumentCollabContext";
import { useDocumentPageContext } from "../documents/DocumentPageContext";
import { Client, useClient } from "../client";
import {
  computeFieldId,
  getDocumentId,
  getIdFromString,
  getRawFieldId,
} from "@storyflow/backend/ids";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { useSegment } from "../layout/components/SegmentContext";
import { useTabUrl } from "../layout/utils";
import { useBuilderPath } from "./BuilderPath";
import { PathMap } from "./FieldContainer";
import { ComponentConfig, LibraryConfig } from "@storyflow/frontend/types";
import { useDocumentIdGenerator } from "../id-generator";
import { tokens } from "@storyflow/backend/tokens";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";
import { createTokenStream } from "shared/parse-token-stream";
import { useAttributesContext } from "./Attributes";

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

const useElementActions = ({
  id,
  listeners,
  push,
}: {
  id: FieldId;
  listeners: ReturnType<typeof createEventsFromIframeToCMS>;
  push: any;
}) => {
  const [, setBuilderPath] = useBuilderPath();

  const [{ elementId, parentId }, setPath] = React.useState<{
    elementId: NestedDocumentId | undefined;
    parentId: FieldId | undefined;
  }>({
    elementId: undefined,
    parentId: undefined,
  });

  const [tree] = useGlobalState<SyntaxTree>(
    parentId ? `${parentId}#tree` : undefined
  );

  const tokenStream = React.useMemo(() => {
    if (!tree) return;
    return createTokenStream(tree);
  }, [tree]);

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

  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const { libraries } = useClientConfig();
  React.useEffect(() => {
    return listeners.createComponent.subscribe(({ path, name, library }) => {
      push({
        target: targetTools.stringify({
          field: "default",
          operation: "computation",
          location: path.split(".").slice(-1)[0],
        }),
        ops: [
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
      });
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

      push({
        target: targetTools.stringify({
          field: "default",
          operation: "computation",
          location: parentId === id ? "" : parentId,
        }),
        ops: [
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
      });
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

      push({
        target: targetTools.stringify({
          field: "default",
          operation: "computation",
          location: parentId === id ? "" : parentId,
        }),
        ops: [
          {
            index,
            remove: 1,
          },
        ],
      });

      setBuilderPath((ps) => ps.slice(0, -1));
    });
  }, [id, libraries, tokenStream, parentId, elementId]);

  const editorComputationToBlocks = () => {
    if (!tokenStream) return [];
    const blocks: { index: number; length: number }[] = [];
    let length = 0;
    tools.forEach(
      tokenStream,
      (value, index) => {
        length++;
        if (tokens.isNestedElement(value)) {
          blocks.push({
            index,
            length,
          });
          length = 0;
        }
      },
      true
    );
    return blocks;
  };

  React.useEffect(() => {
    return listeners.moveComponent.subscribe(({ parent, from, to }) => {
      console.log("MOVE", parent, from, to, tokenStream);
      if (!tokenStream || !parentId) return;
      let fromIndex: number | null = null;
      let toIndex: number | null = null;
      let i = -1;
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

      push({
        target: targetTools.stringify({
          field: "default",
          operation: "computation",
          location: parentId === id ? "" : parentId,
        }),
        ops: [
          {
            index: fromIndex,
            remove: 1,
          },
          {
            index: toIndex,
          },
        ],
      });
    });
  }, [id, tokenStream, parentId]);
};

function Toolbar() {
  const [, navigateTab] = useTabUrl();
  const { current } = useSegment();

  return (
    <div className="flex mb-5">
      <div className="mt-3.5 -ml-2.5 mr-5">
        <Content.ToolbarButton
          icon={ChevronLeftIcon}
          onClick={() => {
            navigateTab(current);
          }}
        >
          Tilbage
        </Content.ToolbarButton>
      </div>
      <div className="mt-3.5 mr-auto flex items-center">
        <PathMap />
      </div>
      {/* isNative && <FieldToolbar documentId={documentId} fieldId={id} /> */}
      <div className="mt-3.5 ml-2">
        <Content.ToolbarButton>Publicer ændringer</Content.ToolbarButton>
      </div>
    </div>
  );
}

export function FieldPage({
  id,
  selected,
  children,
}: {
  id: FieldId;
  selected: boolean;
  children?: React.ReactNode;
}) {
  const listeners = useIframeListeners();
  const dispatchers = useIframeDispatchers();
  const rendered = useBuilderRendered({ listeners });

  const documentId = getDocumentId(id);
  const templateFieldId = getRawFieldId(id);

  const { push } = useDocumentMutate<ComputationOp>(
    documentId,
    templateFieldId
  );

  useElementActions({ id, listeners, push });

  const [currentProp] = useAttributesContext();

  const hide = !currentProp;

  return (
    <Content
      toolbar={<Toolbar />}
      selected={selected}
      className="relative h-[calc(100%-58px)]"
    >
      <PropagateStatePlugin
        id={id}
        rendered={rendered}
        dispatchers={dispatchers}
      />
      <div className="h-full bg-gray-200">
        <div
          className={cl(
            "h-full transition-opacity duration-300",
            rendered ? "opacity-100" : "opacity-0"
          )}
        >
          <BuilderIframe />
        </div>
      </div>
      {!hide && (
        <div className="absolute max-h-[calc(100%-1.25rem)] bg-gray-850 w-96 rounded-md bottom-2.5 right-2.5 overflow-y-auto no-scrollbar">
          {children}
        </div>
      )}
    </Content>
  );
}

export type ComponentRecord = Record<string, ValueArray>;

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
  const finalRecord: ComponentRecord = {};

  const recursivelyGetRecordFromComputation = (fieldId: FieldId) => {
    const state = store.use<ValueArray>(fieldId);

    if (!state.initialized()) {
      const initialValue = record[fieldId] ?? DEFAULT_SYNTAX_TREE;
      state.set(() => calculateFn(fieldId, initialValue, { record, client }));
    }

    const value = state.value!;

    const getChildren = (value: ValueArray): {} => {
      return value.reduce((acc, element) => {
        if (Array.isArray(element)) {
          // this should propably just flat it infinitely out
          return Object.assign(acc, getChildren(element));
        } else if (!tokens.isNestedElement(element)) {
          return acc;
        }
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
              acc.push(...el.props.map((child) => `${el.name}#${child.name}`));
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
  const [tree, setTree] = useGlobalState<ComponentRecord>(
    `${id}/record`,
    () => {
      return getRecordSnapshot(id, {
        record,
        client,
        libraries,
      });
    }
  );

  let oldValue = React.useRef({ ...tree });

  React.useEffect(() => {
    if (rendered) {
      const record = store.use<ComponentRecord>(`${id}/record`).value;
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
