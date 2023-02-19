import React from "react";
import cl from "clsx";

export default function Loader() {
  return (
    <div className="h-1 w-12 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
      <div
        className={cl(
          "h-1 w-12 bg-black/20 dark:bg-white/20 rounded-full",
          "animate-load"
        )}
      />
    </div>
  );
}
