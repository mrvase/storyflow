import React from "react";
import type { Identifier, Draggable, List, Item } from "../types";
import { Delta, useDelta } from "./useDelta";
import { useDragState } from "./useDragState";
import { useEvents } from "./useEvents";

export type DnDContextType = {
  getDelta: (Identifier: Identifier & { isShadow?: boolean }) => Delta;
  mode: "link" | "move" | null;
  shadow: {
    item: Item;
    type: string;
  } | null;
  registerDraggable: (item: Draggable) => () => void;
  registerList: (item: List) => () => void;
  source: Identifier | null;
  getSourceList: () => List | undefined;
  destination: Identifier | null;
  getDestinationList: () => List | undefined;
  getIsCrossList: () => boolean;
  events: {
    startDragging: (
      source: Identifier,
      item: Item,
      mode: "move" | "link"
    ) => void;
    stopDragging: () => void;
  };
};

export const DndContext = React.createContext<DnDContextType | null>(null);

export default function Context({ children }: { children: React.ReactNode }) {
  const [state, setters] = useDragState();

  const getIsCrossList = () =>
    state.source && state.getDestinationList()
      ? state.getDestinationList()?.id !== state.getSourceList()?.id ||
        state.source.index === null
      : false;

  const getDelta = useDelta(state, getIsCrossList);

  const events = useEvents(state, setters);

  console.log("DRAG", state.source, state.destination);

  const ctx = React.useMemo(
    () => ({
      getDelta,
      mode: state.mode,
      source: state.source,
      destination: state.destination,
      getSourceList: state.getSourceList,
      getDestinationList: state.getDestinationList,
      getIsCrossList,
      registerDraggable: setters.registerDraggable,
      registerList: setters.registerList,
      shadow: state.shadow,
      events,
    }),
    [getDelta, state, events.startDragging, events.stopDragging]
  );

  return <DndContext.Provider value={ctx}>{children}</DndContext.Provider>;
}
