import React from "react";

export const Pointer = ({
  color,
  left = 0.5,
  top,
}: {
  top: number;
  left?: number;
  color: string;
}): JSX.Element => {
  const style = {
    top: `${top * 100}%`,
    left: `${left * 100}%`,
  };

  return (
    <div
      style={style}
      className="absolute z-10 w-4 h-4 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-white rounded-full"
      onMouseDown={(ev) => {
        ev.preventDefault();
      }}
    >
      <div style={{ backgroundColor: color }} />
    </div>
  );
};
