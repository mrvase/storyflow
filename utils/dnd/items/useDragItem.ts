import React from "react";
import { DndContext, DnDContextType } from "../context/DragDropContext";
import { useIsShadow } from "./DropShadow";
import { ListContext, ListContextType } from "./Sortable";
import { getFrame } from "../typeGuards";
import { createKey, getBoundingClientRect, translateRect } from "../utils";
import type { CanReceive, Identifier, Item, OnChange } from "../types";
import {
  createDragHandleProps,
  createState,
  noReceive,
  UseDraggableReturn,
} from "./utils";
import { useDragArea } from "./useDragArea";

export type DragState = {
  mode: "move" | "link" | null;
  isShadow: boolean;
  isDragging: boolean;
  isLinking: boolean;
  isDragged: boolean;
  isTarget: boolean;
  isTargetList: boolean;
  acceptsLink: boolean;
  rejectsLink: boolean;
  delta: [x: number, y: number];
  crossList: boolean;
};

export default function useDragItem<
  Element extends HTMLElement = HTMLDivElement,
  T = any
>(props: {
  id: string;
  type: string;
  item?: T;
  canReceive: CanReceive;
  onChange: OnChange;
}): Omit<UseDraggableReturn<Element>, "dragHandleProps">;
export default function useDragItem<
  Element extends HTMLElement = HTMLDivElement,
  T = any
>(props: {
  id?: string;
  type: string;
  item?: T;
  mode: "move" | "link";
}): UseDraggableReturn<Element>;
export default function useDragItem<
  Element extends HTMLElement = HTMLDivElement,
  T = any
>({
  type,
  id,
  item,
  canReceive: canReceiveProp,
  mode: modeProp,
  onChange,
}: {
  id?: string;
  type: string;
  item?: T;
  canReceive?: CanReceive;
  onChange?: OnChange;
  mode?: "move" | "link";
}): UseDraggableReturn<Element> {
  const ctx = React.useContext(DndContext);

  let uniqueAreaId: string | null = null;

  if (onChange) {
    uniqueAreaId = useDragArea({ id: id!, type, onChange });
  }

  if (!ctx) {
    throw new Error("dnd.item must be within dnd.context");
  }

  const [uniqueId] = React.useState(() => createKey());
  const ref = React.useRef<Element | null>(null);
  const disabled = false;
  const canReceive = canReceiveProp ?? noReceive;

  let mode = modeProp ?? null;

  const identifier = React.useMemo(
    () => ({
      type,
      id: id ?? null,
      uniqueId,
      uniqueListId: uniqueAreaId ?? null,
      index: null,
    }),
    [type, id, uniqueAreaId]
  );

  const draggable = React.useMemo(
    () => ({
      identifier,
      disabled,
      canReceive,
      getBoundingClientRect: () => getBoundingClientRect<Element>(ref),
    }),
    [identifier, canReceive, disabled]
  );

  React.useLayoutEffect(() => {
    return ctx.registerDraggable(draggable);
  }, [draggable]);

  const dragHandleProps = React.useMemo(
    () =>
      createDragHandleProps({
        identifier,
        item,
        mode,
        events: ctx.events,
        ref,
      }),
    [identifier, item, mode, ctx.events.startDragging, ctx.events.stopDragging]
  );

  const state = React.useMemo(
    () =>
      createState({
        ctx,
        listId: uniqueAreaId ? id! : null,
        isShadow: false,
        isSortable: false,
        canReceive,
        identifier,
      }),
    [ctx, canReceive, identifier]
  );

  return {
    ref,
    dragHandleProps,
    state,
  };
}
