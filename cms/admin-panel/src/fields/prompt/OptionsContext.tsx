import React from "react";
import { useContextWithError } from "../../utils/contextError";
import { Actions, Reducers, useReducer } from "./useReducer";

function sortByDomNode<T>(
  nodes: T[],
  resolveKey: (item: T) => HTMLElement | null = (i) =>
    i as unknown as HTMLElement | null
): T[] {
  return nodes.slice().sort((aItem, zItem) => {
    let a = resolveKey(aItem);
    let z = resolveKey(zItem);

    if (a === null || z === null) return 0;

    let position = a.compareDocumentPosition(z);

    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

type Item = { id: string; ref: React.MutableRefObject<HTMLDivElement | null> };
type State = {
  items: Item[];
  selectedId: string | null;
  defaultId: string | null;
};

const reducers = {
  selectNext(state) {
    return adjustOrderedState(state, (index) => {
      if (index === null) {
        return state.items.length > 0 ? 1 : 0;
      }
      if (index === state.items.length - 1) {
        return 0;
      }
      return index + 1;
    });
  },
  selectPrevious(state) {
    return adjustOrderedState(state, (index) =>
      ![null, 0].includes(index) ? index! - 1 : state.items.length - 1
    );
  },
  registerItem(state, item: Item) {
    return adjustOrderedState({
      ...state,
      items: [...state.items, item],
    });
  },
  unregisterItem(state, item: Item) {
    return adjustOrderedState({
      ...state,
      items: state.items.filter((i) => i !== item),
      selectedId: state.selectedId === item.id ? null : state.selectedId,
    });
  },
  goToItem(state, indexOrId: number | string) {
    return adjustOrderedState(state, (_, items) => {
      if (typeof indexOrId === "number") {
        return indexOrId;
      } else {
        return items.findIndex((item) => item.id === indexOrId) ?? null;
      }
    });
  },
  deselect(state) {
    return { ...state, selectedId: null };
  },
} satisfies Reducers<State>;

const initialState: State = { items: [], selectedId: null, defaultId: null };

function adjustOrderedState(
  { items, selectedId }: State,
  adjust?: (ps: number | null, items: State["items"]) => number | null
): State {
  let currentItem =
    selectedId !== null ? items.find((el) => el.id === selectedId) : null;

  let sortedItems = sortByDomNode(items.slice(), (item) => item.ref.current);

  let currentIndex = currentItem ? sortedItems.indexOf(currentItem) : null;

  let nextIndex = adjust?.(currentIndex, sortedItems) ?? currentIndex;
  let nextItem = nextIndex !== null ? sortedItems[nextIndex] : null;

  return {
    items: sortedItems,
    selectedId: nextItem?.id ?? null,
    defaultId: sortedItems[0]?.id ?? null,
  };
}

const OptionsContext = React.createContext<{
  selectedId: string | null;
  defaultId: string | null;
  register: (item: Item) => () => void;
  actions: Actions<typeof reducers>;
} | null>(null);

export function Options({ children }: { children: React.ReactNode }) {
  const [state, actions] = useReducer(reducers, initialState);

  const register = React.useCallback((item: Item) => {
    actions.registerItem(item);
    return () => {
      actions.unregisterItem(item);
    };
  }, []);

  const ctx = React.useMemo(() => {
    return {
      selectedId: state.selectedId,
      defaultId: state.defaultId,
      register,
      actions,
    };
  }, [state.selectedId, state.defaultId]);

  return (
    <OptionsContext.Provider value={ctx}>{children}</OptionsContext.Provider>
  );
}

export function useOptionActions() {
  const ctx = useContextWithError(OptionsContext, "Options");
  return ctx.actions;
}

export function useOption() {
  const ctx = useContextWithError(OptionsContext, "Options");

  const id = React.useId();
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const item = {
      id,
      ref,
    };
    return ctx.register(item);
  }, []);

  return [
    ctx.selectedId ? ctx.selectedId === id : ctx.defaultId === id,
    ref,
  ] as [boolean, typeof ref];
}
