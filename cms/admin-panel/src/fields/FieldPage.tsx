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
import { calculateFn } from "./DefaultField";
import { tools } from "shared/editor-tools";
import { ComputationOp, targetTools } from "shared/operations";
import { store, useGlobalState } from "../state/state";
import {
  Computation,
  ComputationBlock,
  FieldId,
  Value,
  ValueRecord,
} from "@storyflow/backend/types";
import { extendPath } from "@storyflow/backend/extendPath";
import Content from "../layout/components/Content";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useLocalStorage } from "../state/useLocalStorage";
import { useClientConfig } from "../client-config";
import { createComponent } from "./Editor/ContentPlugin";
import { useCollab } from "../state/collaboration";
import { useArticlePageContext } from "../articles/ArticlePage";
import { Client, useClient } from "../client";

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

const useCreateComponent = ({
  listeners,
  push,
}: {
  listeners: ReturnType<typeof createEventsFromIframeToCMS>;
  push: any;
}) => {
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
};

export function FieldPage({
  id,
  initialValue,
  selected,
  children,
}: {
  id: FieldId;
  initialValue: Computation;
  selected: boolean;
  children?: React.ReactNode;
}) {
  const listeners = useIframeListeners();
  const dispatchers = useIframeDispatchers();
  const rendered = useBuilderRendered({ listeners });

  const { push } = useCollab().mutate<ComputationOp>(
    id.slice(0, 4),
    id.slice(4)
  );

  useCreateComponent({ listeners, push });

  const [direction, setDirection] = useLocalStorage<
    "horizontal" | "vertical" | "horizontal-reverse" | "vertical-reverse"
  >("panels-direction", "vertical");

  const isHorizontal = direction.split("-")[0] === "horizontal";
  const isReversed = direction.endsWith("reverse");

  const panel1 = <div className="py-5">{children}</div>;

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
    <Content selected={selected} className="h-full">
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
            "group relative bg-white/10 opacity-0 hover:opacity-100 transition-opacity",
            isHorizontal ? "w-2" : "h-2"
          )}
        >
          <div className="absolute inset-0 flex-center">
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
  imports: ComputationBlock[] = [],
  client: Client
): ValueRecord => {
  const recursivelyGetRecordFromComputation = (
    path: string,
    initialValue: Computation
  ): ValueRecord => {
    const state = store.use<Value[]>(path);
    if (!state.initialized()) {
      state.set(() => calculateFn(id, initialValue, imports, client));
    }
    const value = state.value!;
    const children = value.reduce((acc, element) => {
      if (!tools.isLayoutElement(element)) {
        return acc;
      }
      const newPath = element.parent ?? path;

      const props = Object.entries(element.props).reduce(
        (acc, [key, value]) => {
          return Object.assign(
            acc,
            recursivelyGetRecordFromComputation(
              extendPath(newPath, `${element.id}/${key}`),
              value
            )
          );
        },
        {}
      );
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

  // state initialized in ComponentField
  const [tree] = useGlobalState<ComponentRecord>(`${id}/record`, () => {
    return computeComponentRecord(id, initialValue, imports, client);
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
