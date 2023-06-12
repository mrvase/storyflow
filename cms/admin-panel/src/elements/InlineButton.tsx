import cl from "clsx";
import React from "react";

export const InlineButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon?: React.FC<{ className?: string }>;
    active?: boolean;
  }
>(({ icon: Icon, active, ...props }, ref) => {
  return (
    <button
      ref={ref}
      {...props}
      className={cl(
        "shrink-0 h-6 flex-center rounded-full ring-button",
        "text-xs text-gray-600 dark:text-gray-400 font-medium",
        props.children ? "py-1 pl-2 pr-2.5 gap-1" : "p-1",
        "bg-gray-50 dark:bg-gray-800",
        active && "ring-gray-300 dark:ring-gray-600",
        props.className
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {props.children}
    </button>
  );
});
