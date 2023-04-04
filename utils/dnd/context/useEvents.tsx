import React from "react";
import { flushSync } from "react-dom";
import { Identifier, Item, Rect } from "../types";
import {
  DragContextSetters,
  DragContextState,
  rectMapToArray,
} from "./useDragState";

const getDistance = (
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

const getCenterFromRect = (rect: Rect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

export const useEvents = (
  state: DragContextState,
  setters: DragContextSetters
) => {
  React.useEffect(() => {
    if (!state.rectMap) return;

    const coordinates = rectMapToArray(state.rectMap).filter((el) => {
      return (
        !el.disabled &&
        el.canReceive[state.mode]({
          type: state.source.type,
          item: state.shadow.item,
        }) !== "ignore"
      );
    });

    const onDragOver = (ev: DragEvent) => {
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = state.mode ?? "move";
      if (!coordinates || coordinates.length === 0) return;
      const coord = { x: ev.clientX, y: ev.clientY };
      let closest: Identifier | null = null;
      let distance = 99999;
      coordinates.forEach((el) => {
        const current = getDistance(getCenterFromRect(el.rect), coord);
        if (current < distance) {
          distance = current;
          closest = el.identifier;
        }
      });
      if (closest !== state.destination) {
        setters.setDestination(closest);
      }
    };

    document.addEventListener("dragover", onDragOver);
    return () => {
      document.removeEventListener("dragover", onDragOver);
    };
  }, [state.rectMap, state.mode, state.destination, state.shadow]);

  React.useEffect(() => {
    const onDrop = (ev: DragEvent) => {
      ev.preventDefault();
    };
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  const startDragging = React.useCallback(
    (source: Identifier, item: Item, mode: "move" | "link") => {
      flushSync(() => {
        // we flush so that the shadow is present in dom
        // when rects are measured as an immediate response
        // to setSource being called.
        // NOTICE: the shadow still needs to know the source list
        // immediately to determine if it should render
        setters.setMode(mode);
        setters.setShadow({
          item,
          type: source.type,
        });
      });
      setters.setSource(source);
      setters.setDestination(source);
    },
    []
  );

  const stopDragging = React.useCallback(() => {
    setters.resetState();
    if (!state.source) {
      return;
    }

    const { mode, source, destination } = state;

    if (mode === "move") {
      const sourceList = source.uniqueListId
        ? state.getList(source.uniqueListId)
        : undefined;

      const destinationList = destination.uniqueListId
        ? state.getList(destination.uniqueListId)
        : undefined;

      const add = {
        type: "add",
        index: destination.index!,
        item: state.shadow.item,
      } as const;
      const remove = { type: "delete", index: source.index! } as const;

      if (sourceList === destinationList) {
        sourceList?.onChange([remove, add]); // .sort((a, b) => (a.index > b.index ? -1 : 1))
      } else {
        sourceList?.onChange([remove]);
        destinationList?.onChange([add]);
      }
    } else if (mode === "link") {
      const rect = rectMapToArray(state.rectMap).find(
        (el) => el.identifier.uniqueId === destination.uniqueId
      );

      const reject =
        rect?.canReceive.link({
          type: state.source.type,
          item: state.shadow.item,
        }) === "reject";

      if (reject) return;

      const destinationList = destination.uniqueListId
        ? state.getList(destination.uniqueListId)
        : undefined;

      const add = {
        type: "add",
        index: destination.index!,
        item: state.shadow.item,
      } as const;

      destinationList?.onChange([add]);
    }
  }, [state.source, state.rectMap, state.destination, state.mode]);

  return {
    startDragging,
    stopDragging,
  };
};
