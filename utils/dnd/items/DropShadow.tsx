import React from "react";
import { DndContext } from "../context/DragDropContext";
import { ListContext } from "./Sortable";

const DropShadowContext = React.createContext<boolean>(false);

export default function DropShadow({
  children,
}: {
  children: (item: any) => React.ReactNode;
}) {
  const dndCtx = React.useContext(DndContext);
  const listCtx = React.useContext(ListContext);

  if (!dndCtx || !listCtx) {
    throw new Error(
      "DropShadow must be placed within the DragDropContext and Sortable components"
    );
  }

  if (
    dndCtx.mode !== "move" ||
    !dndCtx.shadow?.type ||
    !dndCtx.shadow?.item ||
    listCtx.id === dndCtx.getSourceList()?.id ||
    listCtx.disabled
  ) {
    return null;
  }

  if (
    listCtx.canReceive &&
    listCtx.canReceive.move({
      type: dndCtx.shadow.type,
      item: dndCtx.shadow.item,
    }) === "ignore"
  ) {
    return null;
  }

  return (
    <DropShadowContext.Provider value={true}>
      {children(dndCtx.shadow.item)}
    </DropShadowContext.Provider>
  );
}

export const useIsShadow = () => {
  return React.useContext(DropShadowContext);
};
