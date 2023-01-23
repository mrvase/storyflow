import React from "react";
import { Identifier, Rect } from "../types";
import { DragContextState, DraggableWithRect } from "./useDragState";

export type Delta = [number, number];

const noDelta = [0, 0] as Delta; // for stable reference

const getPositionDiff = (rect1: Rect, rect2: Rect): Delta => {
  return [rect2.left - rect1.left, rect2.top - rect1.top];
};

const getSizeDiff = (rect1: Rect, rect2: Rect): Delta => {
  return [rect2.width - rect1.width, rect2.height - rect1.height];
};

const add = (d1: Delta, d2: Delta): Delta => [d1[0] + d2[0], d1[1] + d2[1]];

export const useDelta = (
  state: DragContextState,
  getIsCrossList: () => boolean
) => {
  const getRect = (list: string | null, index: number | null) => {
    if (!state.rectMap || index === null) {
      return;
    }
    const rect = state.rectMap.get(list ?? "unsorted")?.get(index);
    if (!rect) {
      console.warn("Draggable not found.", state.rectMap, list, index);
    }
    return rect;
  };

  const sorting = React.useMemo(() => {
    if (!state.source) {
      return null;
    }

    const { source, destination, getSourceList, getDestinationList } = state;

    const destinationList = getDestinationList();
    const sourceList = getSourceList();
    const crossList = getIsCrossList();

    const sourceIndex = source.index;
    const destinationIndex = destination.index;

    if (
      !destinationList ||
      destinationIndex === null ||
      source.type !== destinationList.type
    ) {
      return null;
    }

    return {
      isTarget: ({ uniqueListId, index }: Identifier) => {
        return (
          uniqueListId &&
          destinationList.id === state.getList(uniqueListId).id &&
          sourceIndex === index
        );
      },
      isTargetList: ({ uniqueListId }: Identifier) => {
        return (
          uniqueListId && destinationList.id === state.getList(uniqueListId).id
        );
      },
      isShadowTarget: ({
        uniqueListId,
        isShadow,
      }: Identifier & { isShadow?: boolean }) => {
        return (
          uniqueListId &&
          crossList &&
          destinationList.id === state.getList(uniqueListId).id &&
          isShadow
        );
      },
      isAboveAtHome: ({ uniqueListId, index }: Identifier) => {
        return (
          crossList &&
          sourceIndex !== null &&
          uniqueListId &&
          index !== null &&
          sourceList?.id === state.getList(uniqueListId).id &&
          sourceIndex < index
        );
      },
      isAboveAtVisit: ({ uniqueListId, index }: Identifier) => {
        return (
          crossList &&
          uniqueListId &&
          index !== null &&
          destinationList?.id === state.getList(uniqueListId).id &&
          destinationIndex <= index
        );
      },
      isBetweenLow: (
        { uniqueListId, index }: Identifier,
        _sourceIndex: number | null = sourceIndex
      ) => {
        return (
          uniqueListId &&
          _sourceIndex !== null &&
          index !== null &&
          destinationList.id === state.getList(uniqueListId).id &&
          destinationIndex <= index &&
          index < _sourceIndex
        );
      },
      isBetweenHigh: (
        { uniqueListId, index }: Identifier,
        _sourceIndex: number | null = sourceIndex
      ) => {
        return (
          uniqueListId &&
          _sourceIndex !== null &&
          index !== null &&
          destinationList.id === state.getList(uniqueListId).id &&
          _sourceIndex < index &&
          index <= destinationIndex
        );
      },
      direction: crossList ? 0 : sourceIndex! < destinationIndex ? 1 : -1,
    };
  }, [state.mode, state.source, state.destination]);

  const getLocalShadow = (uniqueListId: string) => {
    let shadow: DraggableWithRect | undefined;

    if (!state.source || !sorting) {
      return;
    }

    const currentList = state.getList(uniqueListId);
    const crossList = getIsCrossList();

    const destination =
      state.getDestinationList()!.id === currentList.id
        ? currentList
        : state.getDestinationList()!;

    if (crossList) {
      let current = -1;
      state.rectMap.get(destination.uniqueId!)?.forEach((value, index) => {
        if (index > current) {
          shadow = value;
          current = index;
        }
      });
    } else {
      // since non-list sources sets crossList to true, we now know
      // there must be a sourceList
      const sourceList = state.getSourceList()!;
      const source =
        sourceList!.id === currentList.id ? currentList : sourceList;

      shadow = getRect(source.uniqueId, state.source.index);
    }

    return shadow;
  }; // [state.source, state.rectMap, sorting]

  const getDelta = React.useCallback(
    (identifier: Identifier & { isShadow?: boolean }): Delta => {
      if (
        !state.source ||
        !state.rectMap ||
        !sorting ||
        !identifier.uniqueListId
      ) {
        return noDelta;
      }

      console.log("IDENTIFIER", identifier);

      const shadow = getLocalShadow(identifier.uniqueListId);

      if (!shadow) {
        return noDelta;
      }

      const crossList = getIsCrossList();

      const goesDown =
        !crossList && state.source.index! < state.destination.index!;

      if (
        (!crossList && sorting.isTarget(identifier)) ||
        (crossList && sorting.isShadowTarget(identifier))
      ) {
        const destination = getRect(
          identifier.uniqueListId,
          state.destination.index
        )!;
        // shadow === current
        return add(
          getPositionDiff(shadow.rect, destination.rect),
          goesDown ? getSizeDiff(shadow.rect, destination.rect) : [0, 0]
        );
      }

      const current = getRect(identifier.uniqueListId, identifier.index)!;

      if (
        (!crossList && sorting.isBetweenLow(identifier)) ||
        (crossList && sorting.isAboveAtVisit(identifier))
      ) {
        const next = getRect(identifier.uniqueListId, identifier.index! + 1)!;
        if (!next) return noDelta;
        return add(
          getPositionDiff(current.rect, next.rect),
          getSizeDiff(current.rect, shadow.rect)
        );
      }

      if (
        (!crossList && sorting.isBetweenHigh(identifier)) ||
        (crossList && sorting.isAboveAtHome(identifier))
      ) {
        const prev = getRect(identifier.uniqueListId, identifier.index! - 1)!;
        return add(
          getPositionDiff(current.rect, prev.rect),
          crossList ? [0, 0] : getSizeDiff(shadow.rect, prev.rect)
        );
      }

      return noDelta;
    },
    [state.source, state.rectMap, sorting]
  );

  return getDelta;
};
