import cl from "clsx";
import { TokenStream } from "@storyflow/backend/types";
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
import { useOption } from "./OptionsContext";

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

export function FilePrompt({
  prompt,
  //  holdActions,
  replacePromptWithStream,
}: {
  prompt: string;
  /*
  holdActions: {
    hold: () => void;
    release: () => void;
  };
  */
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const { organization } = useUrlInfo();

  const [files, upload] = useFiles();

  const onEnter = React.useCallback(
    (name: string) => {
      replacePromptWithStream([{ src: name }]);
    },
    [replacePromptWithStream]
  );

  const filteredFiles = React.useMemo(() => {
    const queryLC = prompt.toLowerCase();
    return files.filter((file) => {
      return file.label.toLowerCase().includes(queryLC);
    });
  }, [files, prompt]);

  return (
    <div className="flex p-2.5 items-start gap-3 overflow-x-auto no-scrollbar">
      <div className="shrink-0 flex flex-col">
        <UploadOption
          prompt={prompt}
          upload={async (
            file: File,
            label: string,
            data?: { width?: number; height?: number; size?: number }
          ) => {
            const src = await upload(file, label, data);
            if (!src) return false;
            replacePromptWithStream([{ src }]);
            return true;
          }}
        />
      </div>
      {filteredFiles.map(({ name, label }) => (
        <FileContainer
          name={name}
          label={label}
          organization={organization}
          onEnter={onEnter}
        />
      ))}
    </div>
  );
}

function UploadOption({
  upload,
  prompt,
}: {
  upload: (
    file: File,
    label: string,
    data?: { width?: number; height?: number; size?: number }
  ) => Promise<boolean>;
  prompt: string;
}) {
  const [label, setLabel] = React.useState("");

  const [{ file, preview }, { onChange, dragEvents, resetFile }] = useFileInput(
    (label: string) => {
      if (!prompt) setLabel(label);
      // holdActions.release();
    }
  );

  const [isUploading, setIsUploading] = React.useState(false);

  const [isSelected, ref] = useOption();

  return (
    <>
      <label
        ref={ref as any}
        className={cl(
          "rounded bg-[#ffffff05] p-3 m-0 hover:bg-gray-700 transition-colors text-sm text-center w-52 shrink-0",
          isSelected && "ring-1 ring-gray-700"
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
            const success = await upload(file, prompt || label, size);
            if (success) {
              resetFile();
            }
            setIsUploading(false);
          } else {
            console.log("HOLD");
            // holdActions.hold();
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
          {prompt || label || "Ingen label"}
        </div>
      </label>
      {preview && <DiscardOption discard={() => resetFile()} />}
    </>
  );
}

function DiscardOption({ discard }: { discard: () => void }) {
  const [isSelected, ref] = useOption();

  return (
    <div ref={ref} className="flex gap-2 w-full">
      <button
        className={cl(
          "grow shrink basis-0 bg-[#ffffff05] mt-2 px-3 py-1.5 rounded flex-center hover:bg-gray-700 text-gray-300 text-opacity-75 text-sm",
          isSelected && "ring-1 ring-gray-700"
        )}
        data-image-preview="1"
        onMouseDown={(ev) => {
          ev.preventDefault();
        }}
        onClick={() => {
          discard();
        }}
      >
        Kasser
      </button>
    </div>
  );
}

function FileContainer({
  name,
  label,
  organization,
  onEnter,
}: {
  name: string;
  label: string;
  organization: string;
  onEnter: (name: string) => void;
}) {
  const [isSelected, ref] = useOption();

  const { onClick } = useOptionEvents({
    isSelected,
    onEnter,
    value: name,
  });

  return (
    <div
      ref={ref}
      className={cl(
        "rounded bg-[#ffffff05] p-3 hover:bg-gray-700 transition-colors text-sm text-center w-52 shrink-0",
        isSelected && "ring-1 ring-gray-700"
      )}
      onMouseDown={(ev) => {
        ev.preventDefault();
        onClick();
      }}
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
        <img
          src={src}
          className="max-w-full max-h-full w-auto h-auto"
          loading="lazy"
        />
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