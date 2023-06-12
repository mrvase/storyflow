import cl from "clsx";
import React from "react";
import { getFileExtension, getFileTypeFromExtension } from "../data/files/file";

export const FileContainer = React.forwardRef<
  HTMLDivElement,
  {
    src: string;
    label: string;
  } & React.ComponentProps<"div">
>(({ label, src, ...props }, ref) => {
  const extension = getFileExtension(src);
  const type = getFileTypeFromExtension(extension ?? "");

  const getMedia = () => {
    if (type === "image") {
      return (
        <img
          src={src}
          className="max-w-full max-h-full w-auto h-auto"
          loading="lazy"
        />
      );
    } else if (type === "video") {
      return (
        <video
          style={{ width: "100%", height: "auto" }}
          autoPlay
          muted
          playsInline
          loop
        >
          <source src={src} id="video_here" />
          Your browser does not support HTML5 video.
        </video>
      );
    } else {
      return (
        <div className="font-bold text-sm opacity-50 uppercase">
          {extension}
        </div>
      );
    }
  };

  return (
    <div
      ref={ref}
      {...props}
      className={cl(
        "rounded p-3 bg-gray-100 dark:bg-gray-800",
        props.className
      )}
    >
      <div className="w-full aspect-[4/3] flex-center mb-2">{getMedia()}</div>
      <div className="truncate w-full text-sm text-center">{label}</div>
    </div>
  );
});
