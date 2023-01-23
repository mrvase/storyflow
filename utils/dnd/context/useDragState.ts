import { useRegister } from "@mrvase/utils/hooks";
import React from "react";
import { Draggable, Identifier, List, Rect } from "../types";

type Item = any;

export type DraggableWithRect = Omit<Draggable, "getBoundingClientRect"> & {
  rect: Rect;
};

type RectMap = Map<string, Map<number, DraggableWithRect>>;

type ToTuple<T extends any[] | readonly any[]> = T extends readonly [
  infer First,
  ...infer Rest
]
  ? [First, ...ToTuple<Rest>]
  : T extends [infer First, ...infer Rest]
  ? [First, ...ToTuple<Rest>]
  : T extends []
  ? []
  : never;

function tuple<T extends [any, ...any[]] | readonly [any, ...any[]]>(
  array: T
): ToTuple<T> {
  return array as any;
}

export const rectMapToArray = (map: RectMap) => {
  const array: DraggableWithRect[] = [];
  map.forEach((list) => list.forEach((rect) => array.push(rect)));
  return array;
};

export const useDragState = () => {
  const [draggables, registerDraggable] = useRegister<Draggable>();
  const [lists, registerList] = useRegister<List>((el) => el.uniqueId);

  const getList = (uniqueId: string) => {
    const list = lists.current.get(uniqueId);
    if (!list) {
      throw new Error(`List not subscribed: ${uniqueId}`);
    }
    return list;
  };

  const [mode, setMode] = React.useState<"move" | "link" | null>(null);
  const [source, setSource] = React.useState<Identifier | null>(null);
  const [destination, setDestination] = React.useState<Identifier | null>(null);
  const [shadow, setShadow] = React.useState<{
    item: Item;
    type: string;
  } | null>(null);

  const [rectMap, setRectMap] = React.useState<RectMap | null>(null);

  const readRects = () => {
    setRectMap(() => {
      const result = new Map() as RectMap;

      let missingIndex = 0;

      draggables.current.forEach((el) => {
        const item = {
          canReceive: el.canReceive,
          disabled: el.disabled,
          identifier: el.identifier,
          rect: el.getBoundingClientRect(),
        };
        const listKey = el.identifier.uniqueListId ?? "unsorted";
        const elementKey = item.identifier.index ?? missingIndex++;
        const list = result.get(listKey);
        if (!list) {
          result.set(listKey, new Map([[elementKey, item]]));
        } else {
          list.set(elementKey, item);
        }
      });

      return result;
    });
  };

  if (source !== null && rectMap === null) {
    readRects();
  }

  const resetState = React.useCallback(() => {
    setMode(null);
    setSource(null);
    setDestination(null);
    setShadow(null);
    setRectMap(null);
  }, []);

  const setters = {
    setMode,
    setSource,
    setDestination,
    setShadow,
    resetState,
    registerDraggable,
    registerList,
  };

  const state = React.useMemo(
    () => ({
      shadow: shadow!,
      mode: mode!,
      source: source!,
      getSourceList: () =>
        source?.uniqueListId ? getList(source.uniqueListId) : undefined,
      destination: destination!,
      getDestinationList: () =>
        destination?.uniqueListId
          ? getList(destination.uniqueListId)
          : undefined,
      rectMap: rectMap!,
      getList,
    }),
    [mode, source, destination, rectMap]
  );

  const nullStateWithItem = React.useMemo(
    () => ({
      item: null,
      source: null,
      destination: null,
      rectMap: null,
      getSourceList: () => undefined,
      getDestinationList: () => undefined,
      shadow,
      mode,
      getList,
    }),
    [shadow, mode]
  );

  /**
   * we do not allow a state where not all of
   * theses states are either not-null og null
   */

  if (!source || !destination || !mode || !rectMap) {
    return tuple([nullStateWithItem, setters]);
  }

  return tuple([state, setters]);
};

export type DragContextState = ReturnType<typeof useDragState>[0];
export type DragContextSetters = ReturnType<typeof useDragState>[1];
