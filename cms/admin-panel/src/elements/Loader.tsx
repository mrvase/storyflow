import React from "react";
import cl from "clsx";

export default function Loader({
  size = "sm",
}: {
  size?: "sm" | "md" | "lg" | "full";
}) {
  const sizeClass = {
    sm: "w-12",
    md: "w-24",
    lg: "w-48",
    full: "w-full",
  }[size];

  return (
    <div
      className={cl(
        "h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden",
        sizeClass
      )}
    >
      <div
        className={cl(
          "h-1 bg-black/20 dark:bg-white/20 rounded-full",
          sizeClass,
          "animate-load"
        )}
      />
    </div>
  );
}
