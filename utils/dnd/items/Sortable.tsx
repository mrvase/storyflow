import React from "react";
import { DndContext } from "../context/DragDropContext";
import type { CanReceive, OnChange } from "../types";
import { useDragArea } from "./useDragArea";

export type ListContextType = {
  id: string;
  uniqueId: string;
  canReceive?: CanReceive;
  type: string;
  disabled: boolean;
};

export const ListContext = React.createContext<ListContextType | null>(null);

export default function Sortable({
  id,
  children,
  type,
  canReceive,
  disabled = false,
  onChange,
}: {
  id: string;
  type: string;
  canReceive?: CanReceive;
  children: React.ReactNode;
  disabled?: boolean;
  onChange: OnChange;
}) {
  const ctx = React.useContext(DndContext);

  if (!ctx) {
    throw new Error("dnd.list must be within dnd.context");
  }

  const uniqueId = useDragArea({
    id,
    type,
    onChange,
  });

  const listContext = React.useMemo(
    () => ({ id, uniqueId, type, canReceive, disabled }),
    [id, canReceive, type, disabled]
  );

  return (
    <ListContext.Provider value={listContext}>{children}</ListContext.Provider>
  );
}

export function NoList({ children }: { children: React.ReactNode }) {
  return <ListContext.Provider value={null}>{children}</ListContext.Provider>;
}
