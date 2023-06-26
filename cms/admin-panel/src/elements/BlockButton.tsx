import React from "react";

export const BlockButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon: React.FC<{ className?: string }>;
  }
>(({ icon: Icon, children, ...props }, ref) => {
  return (
    <div className="my-5 px-5 flex justify-start">
      <button
        className="flex items-center text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm font-medium"
        {...props}
      >
        <Icon className="w-5 h-5 mr-5" />
        {children}
      </button>
    </div>
  );
});
