import { DragState } from "@storyflow/dnd";

export function getTranslateDragEffect(state: DragState) {
  const isShadowMode = state.isShadow || state.isDragged;

  const hide =
    (state.isDragged && state.crossList) ||
    (state.isShadow && !state.isTargetList);

  const transform = `translateX(${state.delta[0]}px) translateY(${state.delta[1]}px)`;
  const transition = `transform 200ms cubic-bezier(0.2, 0, 0, 1)`;

  return state.isDragging
    ? ({
        ...(isShadowMode
          ? {
              opacity: 0.5,
              visibility: hide ? ("hidden" as "hidden") : undefined,
              position: state.isShadow && hide ? "absolute" : undefined,
            }
          : {
              transition,
            }),
        transform,
      } as React.CSSProperties)
    : undefined;
}
