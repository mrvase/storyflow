import React from "react";
import TabBar from "./TabBar";
import Branch from "./Branch";
import useTabs from "../../layout/useTabs";
import Sidebar from "./Sidebar";
import { Sortable } from "@storyflow/dnd";
import { useNavigate } from "@storyflow/router";
import Nav from "./Nav";
import { useUrlInfo } from "../../users";
import { useLocalStorage } from "../../state/useLocalStorage";

/**
 * url:      /~1/hej/~2/med/dig
 * segment:  /~1/hej
 * path:     /hej
 */

export default function Layout() {
  const [_noOfTabs, setNoOfTabs] = useLocalStorage<number | null>(
    "no-of-tabs",
    null
  );

  const [pinned, setPinned] = useLocalStorage<number | null>("pinned", null);

  const { tabs, addTab, setTabs } = useTabs();

  let noOfTabs = typeof _noOfTabs === "number" ? _noOfTabs : tabs.length;

  const [sidebarIsOpen] = useLocalStorage<boolean>("sidebar-is-open", false);
  const [navIsOpen] = useLocalStorage<boolean>("nav-is-open", true);

  const navigate = useNavigate();

  const { urlInfoSegment } = useUrlInfo();

  const onChange = React.useCallback(
    (actions: any) => {
      const newTabs = [...tabs];
      for (let action of actions) {
        const { type, index } = action;
        if (type === "add") {
          newTabs.splice(index, 0, action.item);
        }
        if (type === "delete") {
          newTabs.splice(index, 1);
        }
      }
      const path = newTabs.map((el) => el.segment).join("");
      navigate(`${urlInfoSegment}${path}`);
    },
    [tabs, urlInfoSegment, navigate]
  );

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950">
      {<Nav />}
      <div
        className="flex flex-col h-screen grow-0 shrink-0 transition-[width] ease-out"
        style={{
          width: `calc(${[
            "100%",
            navIsOpen && "12rem",
            sidebarIsOpen && "14rem",
          ]
            .filter(Boolean)
            .join(" - ")})`,
        }}
      >
        <div className="w-[calc(100%-8px)] mx-1 grow overflow-x-auto no-scrollbar snap-x snap-mandatory h-[calc(100vh-40px)] overflow-y-hidden">
          <Sortable
            id="tabs"
            type="tabs"
            canReceive={{
              link: () => "ignore",
              move: ({ type }) => (type === "tabs" ? "accept" : "ignore"),
            }}
            onChange={onChange}
          >
            <div
              className="h-full flex mx-auto"
              style={{
                width: `${(1 / noOfTabs) * 100 * tabs.length}%`,
              }}
            >
              {tabs.map((el) => (
                <Branch
                  key={el.key}
                  tab={el}
                  width={`${100 / tabs.length}%`}
                  numberOfVisibleTabs={noOfTabs}
                  pinned={pinned === el.order}
                  togglePin={() =>
                    setPinned((current) =>
                      current === el.order ? null : el.order
                    )
                  }
                />
              ))}
            </div>
          </Sortable>
        </div>
        <TabBar
          tabs={tabs}
          autoSizeTabs={_noOfTabs === null}
          setNoOfTabs={setNoOfTabs}
          addTab={addTab}
        />
      </div>
      <Sidebar />
    </div>
  );
}
