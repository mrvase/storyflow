import React from "react";
import { DndContext } from "../context/DragDropContext";
import { OnChange } from "../types";
import { createKey } from "../utils";

export const useDragArea = ({
  id,
  type,
  onChange,
}: {
  id: string;
  type: string;
  onChange: OnChange;
}) => {
  const ctx = React.useContext(DndContext);

  if (!ctx) {
    throw new Error("dnd.list must be within dnd.context");
  }

  const [uniqueId] = React.useState(() => createKey());

  React.useEffect(() => {
    // console.log("REGISTERING", id, type, uniqueId);
    return ctx.registerList({
      id,
      uniqueId,
      type,
      onChange,
    });
  }, [id, uniqueId, type, onChange]);

  return uniqueId;
};
