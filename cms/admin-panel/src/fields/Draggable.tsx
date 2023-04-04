import React from "react";

export function Draggable({
  children,
  onDrop,
}: {
  children: React.ReactNode;
  onDrop: () => void;
}) {
  const [start, setStart] = React.useState(0);
  const [x, setX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  React.useEffect(() => {
    if (isDragging) {
      const handleMove = (ev: DragEvent) => {
        ev.preventDefault();
        setX(ev.clientX - start);
      };

      window.addEventListener("dragover", handleMove);
      return () => {
        window.removeEventListener("dragover", handleMove);
      };
    }
  }, [isDragging, start]);

  const accepted = Math.abs(x) >= 20;

  React.useEffect(() => {
    if (isDragging) {
      const handleDrop = (ev: DragEvent) => {
        ev.preventDefault();
        if (accepted) {
          onDrop();
        }
      };

      window.addEventListener("drop", handleDrop);
      return () => {
        window.removeEventListener("drop", handleDrop);
      };
    }
  }, [isDragging, accepted]);

  const dragImage = React.useRef<HTMLSpanElement | null>(null);

  const onDragStart = React.useCallback((ev: React.DragEvent) => {
    ev.dataTransfer.setDragImage(dragImage.current!, 0, 0);
    setStart(ev.clientX);
    setIsDragging(true);
  }, []);

  const onDragEnd = React.useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
    setIsDragging(false);
    setX(0);
    setStart(0);
  }, []);

  return (
    <div
      draggable="true"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ transform: `translateX(${Math.min(Math.max(x, -20), 20)}px)` }}
    >
      <span
        ref={dragImage}
        className="absolute block w-1 h-1 pointer-events-none opacity-0"
      ></span>
      {children}
    </div>
  );
}
