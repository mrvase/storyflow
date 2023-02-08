import React from "react";
import { useTabUrl } from "./utils";
import { Tab, UrlTab } from "./types";
import { createKey } from "@storyflow/dnd/utils";

const getTabsFromUrl = (url: string) => {
  let tabs: UrlTab[] = [];
  let index = -1;
  const segments = url.split(/(\/(?:~\d+)?)/g).filter((el) => el !== "");
  console.log("SEGMENTS", segments);
  segments.forEach((el) => {
    if (el.match(/^\/~\d+$/)) {
      index++;
      tabs[index] = {
        index: parseInt(el.match(/\/~(\d+)/)?.[1] ?? "0", 10),
        segment: el,
      };
    } else {
      tabs[index].segment += el;
    }
  });
  return tabs;
};

const mergeTabs = (tabsFromUrl: UrlTab[], tabs: Tab[]): Tab[] => {
  return tabsFromUrl.map((el, index) => {
    const tab = tabs.find((tab) => tab.index === el.index);
    return {
      ...el,
      key: tab?.key ?? createKey(),
      order: index,
    };
  });
};

export default function useTabs() {
  let [url, navigateTab] = useTabUrl();

  const [tabs, setTabs] = React.useState(() =>
    mergeTabs(getTabsFromUrl(url), [])
  );

  const addTab = () => {
    const index = Math.max(...tabs.map((el) => el.index)) + 1;
    navigateTab(`/~${index}`); // since the index does not exist, this is appended to the url
  };

  React.useLayoutEffect(() => {
    setTabs((ps) => mergeTabs(getTabsFromUrl(url), ps));
  }, [url]);

  /*
  const reorderTabs = (startIndex: number, endIndex: number) => {
    setTabs((ps) =>
      ps.map((el) => ({
        ...el,
        order: newOrder(el.order, startIndex, endIndex),
      }))
    );
  };
  */

  return {
    tabs,
    addTab,
    setTabs,
  };
}
