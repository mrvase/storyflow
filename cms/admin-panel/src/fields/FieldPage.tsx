import {
  createEventsFromCMSToIframe,
  createEventsFromIframeToCMS,
} from "@storyflow/frontend/events";
import cl from "clsx";
import React from "react";
import BuilderIframe, {
  useIframeDispatchers,
  useIframeListeners,
} from "./builder/BuilderIframe";
import { calculateFn } from "./default/calculateFn";
import { tools } from "shared/editor-tools";
import { ComputationOp, targetTools } from "shared/operations";
import { store, useGlobalState } from "../state/state";
import {
  Computation,
  ComputationBlock,
  ComputationRecord,
  EditorComputation,
  FieldId,
  Value,
  ValueRecord,
} from "@storyflow/backend/types";
import { extendPath } from "@storyflow/backend/extendPath";
import Content from "../layout/components/Content";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useLocalStorage } from "../state/useLocalStorage";
import { useClientConfig } from "../client-config";
import { createComponent } from "./Editor/createComponent";
import { useCollab } from "../state/collaboration";
import { useArticlePageContext } from "../articles/ArticlePageContext";
import { Client, useClient } from "../client";
import { FieldToolbar } from "../articles/ArticlePage";
import {
  getDocumentId,
  getTemplateDocumentId,
  getTemplateFieldId,
} from "@storyflow/backend/ids";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { useSegment } from "../layout/components/SegmentContext";
import { useTabUrl } from "../layout/utils";
import { stringifyPath } from "./PathContext";
import { PathMap, useBuilderPath } from "./FieldContainer";
import {
  ComponentConfig,
  LibraryConfig,
  Path,
} from "@storyflow/frontend/types";

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
  setBuilderPath,
}: {
  id: FieldId;
  listeners: ReturnType<typeof createEventsFromIframeToCMS>;
  push: any;
  setBuilderPath: (payload: Path | ((ps: Path) => Path)) => void;
}) => {
  const [path, setPath] = React.useState<string | null>(null);

  const parentPath =
    path !== null ? path.split(".").slice(0, -1).join(".") : null;
  const elementId = path !== null ? path.split(".").slice(-1)[0] : null;
  const fullParentPath =
    parentPath !== null ? extendPath(id, parentPath) : null;

  const [computation] = useGlobalState<EditorComputation>(
    fullParentPath !== null ? `${fullParentPath}#computation` : undefined
  );

  React.useEffect(() => {
    return listeners.selection.subscribe((path) => {
      setPath(stringifyPath(path));
    });
  }, []);

  const { libraries } = useClientConfig();
  React.useEffect(() => {
    return listeners.createComponent.subscribe(({ path, name, library }) => {
      push({
        target: targetTools.stringify({
          field: "default",
          operation: "computation",
          location: path.split(".").slice(1).join("."),
        }),
        ops: [
          {
            index: 0,
            insert: [createComponent(name, { library, libraries })],
          },
        ],
      });
    });
  }, [libraries]);

  React.useEffect(() => {
    return listeners.changeComponent.subscribe(({ library, name }) => {
      if (!computation || parentPath == null || elementId === null) return;

      let index = -1;
      tools.forEach(
        computation,
        (value, i) => {
          if (tools.isLayoutElement(value) && value.id === elementId) {
            index = i;
            return true;
          }
        },
        true
      );

      console.log("CHANGE", computation, index, parentPath, library, name);

      if (index < 0) return;

      push({
        target: targetTools.stringify({
          field: "default",
          operation: "computation",
          location: parentPath,
        }),
        ops: [
          {
            index,
            insert: [createComponent(name, { library, libraries })],
            remove: 1,
          },
        ],
      });
    });
  }, [libraries, computation, parentPath, elementId]);

  React.useEffect(() => {
    return listeners.deleteComponent.subscribe(() => {
      if (!computation || parentPath == null || elementId === null) return;

      let index = -1;
      tools.forEach(
        computation,
        (value, i) => {
          if (tools.isLayoutElement(value) && value.id === elementId) {
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
          location: parentPath,
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
  }, [libraries, computation, parentPath, elementId]);

  React.useEffect(() => {
    return listeners.moveComponent.subscribe(({ parent, from, to }) => {
      if (!computation) return;
      if (parent !== fullParentPath) return;
      let fromIndex: number | null = null;
      let toIndex: number | null = null;
      let i = -1;
      tools.forEach(
        computation,
        (value, index) => {
          if (tools.isLayoutElement(value)) {
            i++;
          }
          if (i === from) {
            fromIndex = index;
          }
          if (i === to) {
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

      const location = parent.split(".").slice(1).join(".");
      push({
        target: targetTools.stringify({
          field: "default",
          operation: "computation",
          location,
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
  }, [computation, fullParentPath]);
};

function Toolbar({
  id,
  path,
  setPath,
}: {
  id: FieldId;
  path: Path;
  setPath: (payload: Path | ((ps: Path) => Path)) => void;
}) {
  const documentId = getDocumentId(id);

  const isNative = documentId === getTemplateDocumentId(id);

  const [, navigateTab] = useTabUrl();
  const { current, full } = useSegment();

  return (
    <div className="flex mb-5">
      <div className="mt-5 mr-5">
        <Content.ToolbarButton
          icon={ChevronLeftIcon}
          onClick={() => {
            navigateTab(current);
          }}
        >
          Tilbage
        </Content.ToolbarButton>
      </div>
      <div className="mt-5 mr-auto flex items-center">
        <PathMap path={path} setPath={setPath} />
      </div>
      {isNative && <FieldToolbar documentId={documentId} fieldId={id} />}
      <div className="mt-5 ml-2">
        <Content.ToolbarButton>Gem felt</Content.ToolbarButton>
      </div>
    </div>
  );
}

export function FieldPage({
  id,
  initialValue,
  selected,
  children,
  builderPath,
  setBuilderPath,
}: {
  id: FieldId;
  initialValue: Computation;
  selected: boolean;
  children?: React.ReactNode;
  builderPath: Path;
  setBuilderPath: (payload: Path | ((ps: Path) => Path)) => void;
}) {
  const listeners = useIframeListeners();
  const dispatchers = useIframeDispatchers();
  const rendered = useBuilderRendered({ listeners });

  const documentId = getDocumentId(id);
  const templateFieldId = getTemplateFieldId(id);

  const { push } = useCollab().mutate<ComputationOp>(
    documentId,
    templateFieldId
  );

  useElementActions({ id, listeners, push, setBuilderPath });

  const [direction, setDirection] = useLocalStorage<
    "horizontal" | "vertical" | "horizontal-reverse" | "vertical-reverse"
  >("panels-direction", "vertical");

  const isHorizontal = direction.split("-")[0] === "horizontal";
  const isReversed = direction.endsWith("reverse");

  const panel1 = <div>{children}</div>;

  const panel2 = (
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
  );

  return (
    <Content
      toolbar={<Toolbar id={id} path={builderPath} setPath={setBuilderPath} />}
      selected={selected}
      className="h-[calc(100%-64px)]"
    >
      <PropagateStatePlugin
        id={id}
        rendered={rendered}
        dispatchers={dispatchers}
        initialValue={initialValue}
      />
      <PanelGroup
        direction={direction.split("-")[0] as "horizontal" | "vertical"}
        autoSaveId="panels"
      >
        <Panel collapsible>{isReversed ? panel2 : panel1}</Panel>
        <PanelResizeHandle
          className={cl(
            "group relative bg-white/10 opacity-50 hover:opacity-100 transition-opacity",
            isHorizontal ? "w-1" : "h-1"
          )}
        >
          <div className="absolute z-10 inset-0 flex-center opacity-0 group-hover:opacity-100">
            <div
              className={cl(
                "w-20 h-20 p-2 shrink-0 flex flex-wrap gap-4 bg-gray-800 rounded-lg",
                "scale-75 pointer-events-none group-hover:pointer-events-auto group-hover:scale-100 transition-transform"
              )}
            >
              <div
                className="w-6 h-6 flex bg-gray-700 rounded overflow-hidden cursor-default"
                onClick={() => setDirection("horizontal-reverse")}
              >
                <div className="w-3 bg-white/20" />
                <div className="w-3" />
              </div>
              <div
                className="w-6 h-6 flex-col bg-gray-700 rounded overflow-hidden cursor-default"
                onClick={() => setDirection("vertical-reverse")}
              >
                <div className="h-3 bg-white/20" />
                <div className="h-3" />
              </div>
              <div
                className="w-6 h-6 flex-col bg-gray-700 rounded overflow-hidden cursor-default"
                onClick={() => setDirection("vertical")}
              >
                <div className="h-3" />
                <div className="h-3 bg-white/20" />
              </div>
              <div
                className="w-6 h-6 flex bg-gray-700 rounded overflow-hidden cursor-default"
                onClick={() => setDirection("horizontal")}
              >
                <div className="w-3" />
                <div className="w-3 bg-white/20" />
              </div>
            </div>
          </div>
        </PanelResizeHandle>
        <Panel collapsible>{isReversed ? panel1 : panel2}</Panel>
      </PanelGroup>
    </Content>
  );
}

export type ComponentRecord = Record<string, Computation>;

const recordifyComponent = (
  startPath: string,
  item: Computation
): ComponentRecord => {
  let record: ComponentRecord = {
    [startPath]: item,
  };
  item.forEach((element) => {
    if (tools.isLayoutElement(element)) {
      Object.entries(element.props).forEach(([key, value]) => {
        const path = extendPath(startPath, `${element.id}/${key}`);
        Object.assign(record, recordifyComponent(path, value));
      });
    }
  });
  return record;
};

const computeComponentRecord = (
  id: FieldId,
  initialValue: Computation,
  {
    imports = {},
    client,
    libraries,
  }: {
    imports?: ComputationRecord;
    client: Client;
    libraries: LibraryConfig[];
  }
): ValueRecord => {
  const recursivelyGetRecordFromComputation = (
    path: string,
    initialValue: Computation
  ): ValueRecord => {
    const state = store.use<Value[]>(path);
    if (!state.initialized()) {
      state.set(() => calculateFn(id, initialValue, { imports, client }));
    }
    const value = state.value!;
    const children = value.reduce((acc, element) => {
      if (!tools.isLayoutElement(element)) {
        return acc;
      }
      const newPath = element.parent ?? path;

      // TODO: this can be made more performant
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

      const propKeys =
        components
          .find((el) => el.name === element.type)
          ?.props?.map((el) => el.name) ?? Object.keys(element.props);

      propKeys.push("key");

      const props = propKeys.reduce((acc, key) => {
        return Object.assign(
          acc,
          recursivelyGetRecordFromComputation(
            extendPath(newPath, `${element.id}/${key}`),
            element.props[key] ?? []
          )
        );
      }, {});
      return Object.assign(acc, props);
    }, {});

    return {
      [path]: value,
      ...children,
    };
  };

  return recursivelyGetRecordFromComputation(id, initialValue);
};

function PropagateStatePlugin({
  id,
  rendered,
  dispatchers,
  initialValue,
}: {
  id: FieldId;
  rendered: boolean;
  dispatchers: ReturnType<typeof createEventsFromCMSToIframe>;
  initialValue: Computation;
}) {
  const { imports } = useArticlePageContext();

  const client = useClient();

  const { libraries } = useClientConfig();

  // state initialized in ComponentField
  const [tree] = useGlobalState<ComponentRecord>(`${id}/record`, () => {
    return computeComponentRecord(id, initialValue, {
      imports,
      client,
      libraries,
    });
  });

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
