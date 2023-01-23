import { DnDContextType } from "../context/DragDropContext";
import { CanReceive, Identifier, Item } from "../types";
import { ListContextType } from "./Sortable";

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

export type UseDraggableReturn<Element> = {
  state: DragState;
  dragHandleProps: Record<string, any> | undefined;
  ref: React.MutableRefObject<Element | null>;
};

export const noReceive: CanReceive = {
  link: () => "ignore",
  move: () => "ignore",
};

export const createDragHandleProps = <Element extends HTMLElement>({
  mode,
  ref,
  identifier,
  events,
  item,
}: {
  mode: "move" | "link" | null;
  ref: React.MutableRefObject<Element | null>;
  identifier: Identifier;
  events: DnDContextType["events"];
  item: Item;
}) =>
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
              const { left: x, top: y } = ref.current.getBoundingClientRect();
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
          events.startDragging(identifier, item, mode);
        },
        onDragEnd: (ev: DragEvent) => {
          console.log("DRAG END");
          events.stopDragging();
        },
      } as Record<string, any>);

export const createState = ({
  ctx,
  listId,
  isShadow,
  isSortable,
  canReceive,
  identifier,
}: {
  ctx: DnDContextType;
  listId: string | null;
  isShadow: boolean;
  isSortable: boolean;
  canReceive: CanReceive;
  identifier: Identifier;
}) => {
  const isDragging = Boolean(ctx.source) && ctx.mode === "move";
  const isLinking = Boolean(ctx.source) && ctx.mode === "link";
  const isDragged =
    !isShadow &&
    ((identifier.id && ctx.source?.id === identifier.id) ||
      ctx.source?.uniqueId === identifier.uniqueId);
  const isTarget =
    (identifier.id && ctx.destination?.id === identifier.id) ||
    ctx.source?.uniqueId === identifier.uniqueId;
  const isTargetList = listId ? ctx.getDestinationList()?.id === listId : false;

  const linkResult =
    ctx.mode === "link" && ctx.source && ctx.shadow?.item
      ? canReceive.link({ type: ctx.source.type, item: ctx.shadow.item })
      : "ignore";

  const delta =
    ctx.mode === "move" && isSortable
      ? ctx.getDelta({ ...identifier, isShadow: Boolean(isShadow) })
      : ([0, 0] as [number, number]);

  return {
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
  };
};
