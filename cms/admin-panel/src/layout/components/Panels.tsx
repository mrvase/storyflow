import cl from "clsx";
import React from "react";
import { Sortable } from "@storyflow/dnd";
import { PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { usePanels, usePanelActions } from "../../panel-router/PanelRouter";
import { Panel } from "./Panel";
import { Routes } from "../../panel-router/Routes";
import { LinkReceiver } from "./LinkReceiver";
import { RouteConfig } from "../../panel-router/types";

export function Panels({ routes }: { routes: RouteConfig[] }) {
  const panels = usePanels();
  const panelActions = usePanelActions();

  const onChange = React.useCallback(
    (actions: any) => {
      let start: number | null = null;
      let end: number | null = null;
      for (let action of actions) {
        const { type, index } = action;
        if (type === "add") {
          end = index;
        }
        if (type === "delete") {
          start = index;
        }
      }
      if (start !== null && end !== null) {
        panelActions.move({ start, end });
      }
    },
    [panelActions]
  );

  return (
    <div className="relative w-full h-full flex overflow-hidden">
      <LinkReceiver index={0} edge="left" id="link-left" />
      <Sortable
        type="panels"
        id="panels"
        onChange={onChange}
        canReceive={{
          link: () => "ignore",
          move: ({ type }) => (type === "panels" ? "accept" : "ignore"),
        }}
      >
        <PanelGroup direction="horizontal">
          {panels.data.map((data) => (
            <React.Fragment key={data.key}>
              {data.index !== 0 && (
                <PanelResizeHandle
                  className={cl("group h-full relative", "w-2")}
                  style={{
                    order: data.index,
                  }}
                >
                  <LinkReceiver index={data.index} id={`new-${data.key}`} />
                </PanelResizeHandle>
              )}
              <Panel data={data} single={panels.data.length === 1}>
                <Routes routes={routes} data={data} />
              </Panel>
            </React.Fragment>
          ))}
        </PanelGroup>
      </Sortable>
      <LinkReceiver index={panels.data.length} edge="right" id="link-right" />
    </div>
  );
}
