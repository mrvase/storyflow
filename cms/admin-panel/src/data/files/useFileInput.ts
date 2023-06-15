import React from "react";
import { getFileType } from "./file";

const initialState = {
  file: null,
  preview: null,
  dragging: false,
};

export function useFileInput(
  options: {
    setLabel?: (label: string) => void;
    onFile?: (file: File) => void;
  } = {}
) {
  const [state, setState] = React.useState<{
    dragging: boolean;
    file: null | File;
    preview: null | string;
  }>(initialState);

  const enteredElement = React.useRef<HTMLLabelElement | null>(null);

  const setFileOnUpload = async (newFile: File) => {
    const type = getFileType(newFile.type);
    console.log("TYPE", newFile.type, type);
    if (type === null) return;
    options.setLabel?.(newFile.name.replace(/(.*)\.[^.]+$/, "$1"));
    options.onFile?.(newFile);
    setState((ps) => ({
      ...ps,
      file: newFile,
      ...(["image", "video"].includes(type) && {
        preview: URL.createObjectURL(newFile),
      }),
    }));
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
      setState((ps) => ({ ...ps, dragging: false }));
      const newFile = ev.dataTransfer.files?.[0];
      if (newFile) setFileOnUpload(newFile);
    }
  };

  const onDragEnter = (ev: React.DragEvent<HTMLLabelElement>) => {
    if (ev.dataTransfer.types.includes("Files")) {
      ev.preventDefault();
      ev.stopPropagation();
      setState((ps) => ({ ...ps, dragging: true }));
    }
  };

  const onDragLeave = (ev: React.DragEvent<HTMLLabelElement>) => {
    if (ev.dataTransfer.types.includes("Files")) {
      ev.preventDefault();
      ev.stopPropagation();
      if (enteredElement.current === ev.target) {
        setState((ps) => ({ ...ps, dragging: false }));
        enteredElement.current = null;
      }
    }
  };

  const resetFile = () => {
    setState(initialState);
    options.setLabel?.("");
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
