import React from "react";
import { DndContext } from "../context/DragDropContext";
import { useIsShadow } from "./DropShadow";
import { ListContext } from "./Sortable";
import { getFrame } from "../typeGuards";
import { createKey, translateRect } from "../utils";
import type { CanReceive } from "../types";

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

type ListItemProps<T> = {
  isSortable: true;
  id?: string;
  index: number;
  item: T;
  type?: string;
  canReceive?: CanReceive;
  mode?: "move" | "link";
};

type StandaloneReceiveProps<T> = {
  id?: string;
  type: string;
  item: T;
  canReceive: CanReceive;
};

type StandaloneDeliverProps<T> = {
  id?: string;
  type: string;
  item: T;
  mode: "move" | "link";
};

type StandaloneProps<T> = {
  id?: string;
  type: string;
  item: T;
  canReceive: CanReceive;
  mode: "move" | "link";
};

type Props<T = any> = {
  isSortable?: true;
  id?: string;
  type?: string;
  index?: number;
  item?: T;
  canReceive?: CanReceive;
  mode?: "move" | "link";
};

type UseDraggableReturn = {
  state: DragState;
  dragHandleProps: Record<string, any> | undefined;
  ref: React.MutableRefObject<HTMLDivElement | null>;
};

const noReceive: CanReceive = {
  link: () => "ignore",
  move: () => "ignore",
};

/** SHADOW STATE */
export default function useDraggable<T>(
  props: ListItemProps<T>
): UseDraggableReturn;
export default function useDraggable<T, U extends StandaloneReceiveProps<T>>(
  props: U
): Omit<UseDraggableReturn, "dragHandleProps">;
export default function useDraggable<T, U extends StandaloneDeliverProps<T>>(
  props: U
): UseDraggableReturn;
export default function useDraggable<T, U extends StandaloneProps<T>>(
  props: U
): UseDraggableReturn;
/** NORMAL STATE */
export default function useDraggable<T>({
  type: typeProp,
  id,
  index,
  item,
  canReceive: canReceiveProp,
  mode: modeProp,
}: Props<T>): UseDraggableReturn {
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
  const ref = React.useRef<HTMLDivElement | null>(null);
  const list = React.useContext(ListContext);

  const type = typeProp ?? list?.type;

  if (list && !(canReceiveProp ?? list?.canReceive)) {
    throw new Error(
      "When using a Sortable, canReceive must be specified in list or item."
    );
  }

  const disabled = list?.disabled ?? false;

  const canReceive = canReceiveProp ?? list?.canReceive ?? noReceive;

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
      uniqueListId: list ? list.uniqueId : null,
      index: index ?? null,
    }),
    [type, id, list, index]
  );

  const prevId = React.useRef(uniqueId);
  React.useEffect(() => {
    if (prevId.current !== uniqueId) {
      prevId.current = uniqueId;
      console.log("UNIQUE ID CHANGED");
    }
  }, [uniqueId]);

  const dragHandleProps = React.useMemo(
    () =>
      !mode
        ? undefined
        : ({
            draggable: "true",
            onDragStart: (ev: DragEvent) => {
              if (!mode) return;
              ev.stopPropagation();
              if (ev.dataTransfer) {
                ev.dataTransfer.dropEffect = "move";
                if (ref.current) {
                  const { left: x, top: y } =
                    ref.current.getBoundingClientRect();
                  const { clientX, clientY } = ev;
                  /*
                  let isChrome = navigator.userAgent.match(
                    /chrome|chromium|crios/i
                  );
                  let ratio = window.devicePixelRatio;
                  */
                  let scale = 1;
                  ev.dataTransfer.setDragImage(
                    ref.current,
                    (clientX - x) * scale,
                    (clientY - y) * scale
                  );
                }
              }
              ctx.events.startDragging(identifier, item, mode);
            },
            onDragEnd: (ev: DragEvent) => {
              console.log("DRAG END");
              ctx.events.stopDragging();
            },
          } as Record<string, any>),
    [identifier, item, mode, ctx.events.startDragging, ctx.events.stopDragging]
  );

  const getBoundingClientRect = () => {
    if (!ref.current) {
      return {
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
      };
    }
    const frameRect = getFrame(ref.current)?.getBoundingClientRect?.() ?? {
      left: 0,
      top: 0,
    };

    const rect = ref.current?.getBoundingClientRect();

    return translateRect(
      {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        height: rect.height,
        width: rect.width,
        isShadow,
      },
      frameRect
    );
  };

  const draggable = React.useMemo(
    () => ({
      identifier,
      disabled,
      canReceive,
      getBoundingClientRect,
    }),
    [identifier, canReceive, disabled]
  );

  React.useEffect(() => {
    ctx.registerDraggable(draggable);
  }, [draggable]);

  const isDragging = Boolean(ctx.source) && ctx.mode === "move";
  const isLinking = Boolean(ctx.source) && ctx.mode === "link";
  const isDragged =
    !isShadow &&
    ((id && ctx.source?.id === id) || ctx.source?.uniqueId === uniqueId);
  const isTarget =
    (id && ctx.destination?.id === id) || ctx.source?.uniqueId === uniqueId;
  const isTargetList = list?.id
    ? ctx.getDestinationList()?.id === list.id
    : false;

  const linkResult =
    ctx.mode === "link" && ctx.source && ctx.shadow?.item
      ? canReceive.link({ type: ctx.source.type, item: ctx.shadow.item })
      : "ignore";

  const delta =
    ctx.mode === "move"
      ? ctx.getDelta({ ...identifier, isShadow: Boolean(isShadow) })
      : ([0, 0] as [number, number]);

  return {
    dragHandleProps,
    ref,
    state: {
      isShadow: Boolean(isShadow),
      isDragging,
      isLinking,
      isDragged,
      isTarget,
      isTargetList,
      mode: ctx.mode,
      crossList: ctx.getIsCrossList(),
      delta,
      acceptsLink: linkResult === "accept",
      rejectsLink: linkResult === "reject",
    },
  };
}
