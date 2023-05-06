import React from "react";
import { DndContext } from "../context/DragDropContext";
import { useIsShadow } from "./DropShadow";
import { ListContext } from "./Sortable";
import { createKey, getBoundingClientRect } from "../utils";
import type { CanReceive } from "../types";
import {
  createDragHandleProps,
  createState,
  DragState,
  noReceive,
} from "./utils";

type UseDraggableReturn<Element> = {
  state: DragState;
  dragHandleProps: Record<string, any> | undefined;
  ref: React.MutableRefObject<Element | null>;
};

export default function useDraggable<
  Element extends HTMLElement = HTMLDivElement,
  T = any
>({
  type: typeProp,
  id,
  index,
  item,
  canReceive: canReceiveProp,
  mode: modeProp,
}: {
  id?: string;
  index: number;
  item?: T;
  type?: string;
  canReceive?: CanReceive;
  mode?: "move" | "link";
}): UseDraggableReturn<Element> {
  const ctx = React.useContext(DndContext);

  const isShadow = useIsShadow();

  if (isShadow) {
    item = undefined;
    modeProp = undefined;
    canReceiveProp = undefined;
  }

  if (!ctx) {
    throw new Error("dnd.item must be within dnd.context");
  }

  const [uniqueId] = React.useState(() => createKey());
  const ref = React.useRef<Element | null>(null);

  const list = React.useContext(ListContext);

  if (!list) {
    throw new Error(
      "useSortableItem must be used within the Sortable component."
    );
  }
  if (!(canReceiveProp ?? list?.canReceive)) {
    throw new Error(
      "When using a Sortable, canReceive must be specified in list or item."
    );
  }

  const type = typeProp ?? list.type;

  const disabled = list.disabled ?? false;

  const canReceive = canReceiveProp ?? list.canReceive ?? noReceive;

  let mode = modeProp ?? (list ? "move" : null);

  if (!type) {
    throw new Error(
      "type must be specified in useDraggable props or parent Sortable component."
    );
  }

  const identifier = React.useMemo(
    () => ({
      type,
      id: id ?? null,
      uniqueId,
      uniqueListId: list.uniqueId,
      index: index ?? null,
    }),
    [type, id, list, index]
  );

  const draggable = React.useMemo(
    () => ({
      identifier,
      disabled,
      canReceive,
      getBoundingClientRect: () => getBoundingClientRect(ref),
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
        listId: list.id,
        isSortable: true,
        isShadow,
        canReceive,
        identifier,
      }),
    [ctx, list, isShadow, canReceive, identifier]
  );

  return {
    ref,
    dragHandleProps: disabled ? {} : dragHandleProps,
    state,
  };
}
