import cl from "clsx";
import { EditorComputation } from "@storyflow/backend/types";
import React from "react";
import {
  getFileExtension,
  getFileType,
  getFileTypeFromExtension,
  getImageSize,
  getVideoSize,
} from "../../utils/file";
import { useFiles } from "../../files";
import { Spinner } from "../../elements/Spinner";
import { useUrlInfo } from "../../users";
import { useOptionEvents } from "./Option";

function useFileInput(setLabel?: (label: string) => void) {
  const [dragging, setDragging] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<null | File>(null);

  const state = {
    file,
    preview,
  };

  const enteredElement = React.useRef<HTMLLabelElement | null>(null);

  const setFileOnUpload = async (newFile: File) => {
    const type = getFileType(newFile.type);
    if (type === null) return;
    if (["image", "video"].includes(type)) {
      setPreview(URL.createObjectURL(newFile));
    }
    setLabel?.(newFile.name.replace(/(.*)\.[^.]+$/, "$1"));
    setFile(newFile);
  };

  const onChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = ev.target.files?.[0] ?? null;
    if (newFile) {
      setFileOnUpload(newFile);
    }
  };

  const onDragOver = (ev: React.DragEvent<HTMLLabelElement>) => {
    if (ev.dataTransfer.types.includes("Files")) {
      enteredElement.current = ev.currentTarget;
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  const onDrop = (ev: React.DragEvent<HTMLLabelElement>) => {
    if (ev.dataTransfer.types.includes("Files")) {
      ev.preventDefault();
      ev.stopPropagation();
      setDragging(false);
      const newFile = ev.dataTransfer.files?.[0];
      if (newFile) setFileOnUpload(newFile);
    }
  };

  const onDragEnter = (ev: React.DragEvent<HTMLLabelElement>) => {
    if (ev.dataTransfer.types.includes("Files")) {
      ev.preventDefault();
      ev.stopPropagation();
      setDragging(true);
    }
  };

  const onDragLeave = (ev: React.DragEvent<HTMLLabelElement>) => {
    if (ev.dataTransfer.types.includes("Files")) {
      ev.preventDefault();
      ev.stopPropagation();
      if (enteredElement.current === ev.target) {
        setDragging(false);
        enteredElement.current = null;
      }
    }
  };

  const resetFile = () => {
    setFile(null);
    setPreview(null);
    setLabel?.("");
  };

  const actions = {
    onChange,
    dragEvents: {
      onDragOver,
      onDrop,
      onDragEnter,
      onDragLeave,
    },
    resetFile,
  };

  return [state, actions] as [typeof state, typeof actions];
}

export function QueryFiles({
  query,
  selected,
  reset,
  holdActions,
  insertComputation,
}: {
  query: string;
  selected: number;
  reset: () => void;

  holdActions: {
    hold: () => void;
    restore: () => void;
  };
  insertComputation: (computation: EditorComputation) => void;
}) {
  const { organization } = useUrlInfo();

  const searchQuery = query.match(/\"([^\"]*)/)?.[1] ?? query;

  const [files, upload] = useFiles();

  const [label, setLabel] = React.useState("");

  const [{ file, preview }, { onChange, dragEvents, resetFile }] = useFileInput(
    (label: string) => {
      if (!query) setLabel(label);
      holdActions.restore();
    }
  );

  const previewOption = preview ? 1 : 0;

  const optionsLength = files.length + 1 + previewOption;

  const current = selected < 0 ? selected : selected % optionsLength;

  const initialCurrent = React.useRef<number | null>(current);

  React.useEffect(() => {
    if (current !== initialCurrent.current) {
      const el = document.querySelector(`[data-image-preview="${current}"]`);
      if (el) el.scrollIntoView();
      initialCurrent.current = null; // stop blocking at initialCurrent
    }
  }, [current]);

  const [isUploading, setIsUploading] = React.useState(false);

  const onEnter = React.useCallback(
    (name: string) => {
      insertComputation([{ src: name }]);
    },
    [insertComputation]
  );

  const filteredFiles = React.useMemo(() => {
    const queryLC = query.toLowerCase();
    return files.filter((file) => {
      return file.label.toLowerCase().includes(queryLC);
    });
  }, [files, query]);

  return (
    <div className="flex items-start gap-3 overflow-x-auto no-scrollbar p-[1px] -m-[1px]">
      <div className="shrink-0 flex flex-col">
        <label
          className={cl(
            "rounded bg-[#ffffff05] p-3 m-0 hover:bg-gray-700 transition-colors text-sm text-center w-52 shrink-0",
            current === 0 && "ring-1 ring-gray-700"
          )}
          data-image-preview="0"
          onMouseDown={(ev) => {
            ev.preventDefault();
          }}
          onClick={async (ev) => {
            if (preview) {
              ev.preventDefault();
              if (!file) return;
              const type = getFileType(file.type);
              if (!type) return;
              setIsUploading(true);
              let size: {
                width?: number;
                height?: number;
                size?: number;
              } | null = {
                size: file.size,
              };
              if (["image", "video"].includes(type)) {
                const measure = type === "image" ? getImageSize : getVideoSize;
                size = await measure(preview);
              }
              const src = await upload(file, query || label, size);
              if (!src) return;
              resetFile();
              setIsUploading(false);
              insertComputation([{ src }]);
            } else {
              holdActions.hold();
            }
          }}
          {...dragEvents}
        >
          <input
            type="file"
            className="absolute w-0 h-0 opacity-0"
            onChange={onChange}
          />
          <div className="relative w-full aspect-[4/3] flex-center mb-2">
            {preview ? (
              <img
                src={preview}
                className="max-w-full max-h-full w-auto h-auto"
              />
            ) : (
              <span className="text-gray-300 text-opacity-75">Tilføj fil</span>
            )}

            <div
              className={cl(
                "absolute inset-0 bg-black/50 flex-center transition-opacity",
                isUploading ? "opacity-100" : "opacity-0"
              )}
            >
              {isUploading && <Spinner />}
            </div>
          </div>
          <div className="truncate w-full">
            {query || label || "Ingen label"}
          </div>
        </label>
        {preview && (
          <div className="flex gap-2 w-full">
            <button
              className={cl(
                "grow shrink basis-0 bg-[#ffffff05] mt-2 px-3 py-1.5 rounded flex-center hover:bg-gray-700 text-gray-300 text-opacity-75 text-sm",
                current === 1 && "ring-1 ring-gray-700"
              )}
              data-image-preview="1"
              onMouseDown={(ev) => {
                ev.preventDefault();
              }}
              onClick={() => {
                resetFile();
              }}
            >
              Kasser
            </button>
          </div>
        )}
      </div>
      {filteredFiles.map(({ name, label }, index) => (
        <FileContainer
          name={name}
          label={label}
          index={index + 1 + previewOption}
          isSelected={current === index + 1 + previewOption}
          organization={organization}
          onEnter={onEnter}
        />
      ))}
    </div>
  );
}
function FileContainer({
  isSelected,
  index,
  name,
  label,
  organization,
  onEnter,
}: {
  isSelected: boolean;
  index: number;
  name: string;
  label: string;
  organization: string;
  onEnter: (name: string) => void;
}) {
  const { onClick } = useOptionEvents({
    isSelected,
    onEnter,
    value: name,
  });

  return (
    <div
      className={cl(
        "rounded bg-[#ffffff05] p-3 hover:bg-gray-700 transition-colors text-sm text-center w-52 shrink-0",
        isSelected && "ring-1 ring-gray-700"
      )}
      onMouseDown={(ev) => {
        ev.preventDefault();
        onClick();
      }}
      data-image-preview={`${index}`}
    >
      <div className="w-full aspect-[4/3] flex-center mb-2">
        <File name={name} organization={organization} />
      </div>
      <div className="truncate w-full">{label}</div>
    </div>
  );
}
function File({ name, organization }: { name: string; organization: string }) {
  const type = getFileTypeFromExtension(getFileExtension(name) ?? "");
  const src = `https://awss3stack-mybucket15d133bf-1wx5fzxzweii4.s3.eu-west-1.amazonaws.com/${organization}/${name}`;
  return (
    <>
      {type === "image" && (
        <img src={src} className="max-w-full max-h-full w-auto h-auto" />
      )}
      {type === "video" && (
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
      )}
    </>
  );
}
