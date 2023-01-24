import cl from "clsx";
import React from "react";

const colors = {
  blue: "hover:bg-sky-100 hover:text-sky-700",
  green: "hover:bg-green-100 hover:text-green-700",
};

export function IconButton({
  className,
  icon,
  color = "blue",
  ...props
}: React.ComponentProps<"button"> & {
  icon: React.FC<any>;
  color?: keyof typeof colors;
}) {
  const Icon = icon;

  return (
    <button
      {...props}
      className={cl(
        "rounded-full h-8 w-8 m-1 flex-center transition-colors shrink-0",
        colors[color],
        className
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
