import { useLocation, useNavigate } from "@storyflow/router";
import React from "react";
import { useContextWithError } from "../../utils/contextError";
import { createKey } from "../../utils/createKey";
import { modifyValues } from "../../utils/modifyValues";
import {
  Actions,
  Reducers,
  useReducerWithReturnValue,
} from "../../utils/useReducer";
import type { PanelData, Panels } from "./types";
import { getPanelsFromUrl, getUrlFromPanels } from "./utils";

export const PanelsContext = React.createContext<Panels | null>(null);

export const PanelActionsContext = React.createContext<Actions<
  typeof reducers
> | null>(null);

export const usePanels = () =>
  useContextWithError(PanelsContext, "PanelsContext");

export const usePanelActions = () =>
  useContextWithError(PanelActionsContext, "PanelActionsContext");

const insert = (data: PanelData[], item: PanelData): PanelData[] => {
  return [
    ...data.map((data) => {
      if (data.index >= item.index) {
        return {
          ...data,
          index: data.index + 1,
        };
      }
      return data;
    }),
    item,
  ];
};
const remove = (data: PanelData[], index: number): PanelData[] => {
  return data.reduce((acc, data) => {
    if (data.index > index) {
      acc.push({
        ...data,
        index: data.index - 1,
      });
    } else if (data.index < index) {
      acc.push(data);
    }
    return acc;
  }, [] as PanelData[]);
};

const move = (data: PanelData[], start: number, end: number): PanelData[] => {
  return data.reduce((acc, data) => {
    if (
      (data.index > start && data.index > end) ||
      (data.index < start && data.index < end)
    ) {
      acc.push(data);
    } else if (data.index === start) {
      acc.push({
        ...data,
        index: end,
      });
    } else {
      acc.push({
        ...data,
        index: data.index + (end > start ? -1 : 1),
      });
    }
    return acc;
  }, [] as PanelData[]);
};

const reducers = {
  reconcile({ prefix, data }, url: string) {
    const newState = getPanelsFromUrl(url);

    if (data.length !== newState.data.length) {
      return newState;
    }

    return {
      prefix: newState.prefix,
      data: data.map((el) => ({
        key: el.key,
        index: el.index,
        path: newState.data[el.index].path,
      })),
    };
  },
  open(state, payload: { path: string; index: number }) {
    const index =
      payload.index < 0 ? state.data.length + 1 + payload.index : payload.index;

    return {
      prefix: state.prefix,
      data: insert(state.data, {
        key: createKey(),
        path: payload.path || "/",
        index,
      }),
    };
  },
  close(state, index: number) {
    if (state.data.length <= 1 || index >= state.data.length) {
      return state;
    }
    return {
      prefix: state.prefix,
      data: remove(state.data, index),
    };
  },
  move(state, payload: { start: number; end: number }) {
    return {
      prefix: state.prefix,
      data: move(state.data, payload.start, payload.end),
    };
  },
} satisfies Reducers<Panels>;

// normalized: url '/~/tab1-1/tab1-2/~/tab2

export function PanelRouter({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  let location = useLocation();

  const [panels, actions] = useReducerWithReturnValue(
    reducers,
    getPanelsFromUrl(location.pathname)
  );

  const isLocalNavigation = React.useRef(false);

  const actionsWithNavigation = React.useMemo(
    () =>
      modifyValues(actions, (value) => {
        const newFunc: typeof value = (...args: any[]) => {
          const newState = (value as any)(...args);
          isLocalNavigation.current = true;
          const href = getUrlFromPanels(newState);
          navigate(href);
          return newState;
        };
        return newFunc;
      }) as typeof actions,
    [actions, navigate]
  );

  React.useLayoutEffect(() => {
    if (!isLocalNavigation.current) {
      console.log("NEW PATH", location.pathname);
      actions.reconcile(location.pathname);
    } else {
      isLocalNavigation.current = false;
    }
    // important that it reacts to any location change, not just pathname,
    // so that if pathname does not change, it still sets isLocalNavigation
    // to false
  }, [location]);

  return (
    <PanelsContext.Provider value={panels}>
      <PanelActionsContext.Provider value={actionsWithNavigation}>
        {children}
      </PanelActionsContext.Provider>
    </PanelsContext.Provider>
  );
}
