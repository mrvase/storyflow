import cl from "clsx";
import React from "react";

export const InlineButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon?: React.FC<{ className?: string }>;
    active?: boolean;
    color?: "gray" | "teal";
  }
>(({ icon: Icon, active, color, ...props }, ref) => {
  const colorClasses = {
    gray: "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-850 ring-gray-200 hover:ring-gray-300 dark:ring-gray-700 dark:hover:ring-gray-600",
    teal: "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-800/10 ring-teal-200 hover:ring-teal-300 dark:ring-teal-700 dark:hover:ring-teal-600",
  }[color ?? "gray"];
  return (
    <button
      ref={ref}
      {...props}
      className={cl(
        "shrink-0 h-6 flex-center rounded-full",
        "text-xs font-medium",
        "ring-1 duration-75 transition-shadow",
        props.children ? "py-1 pl-2 pr-2.5 gap-1" : "p-1",
        colorClasses,
        active && "ring-gray-300 dark:ring-gray-600",
        props.className
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {props.children}
    </button>
  );
});
