type ImageData = {
  width: number;
  height: number;
};

type VideoData = {
  width: number;
  height: number;
  // framerate: number;
  duration: number; // seconds
};

type TextData = {
  size: number;
};

type ApplicationData = {
  size: number;
};

type FileData = ImageData | VideoData | TextData | ApplicationData;

function stringify(type: "image", data: ImageData): string;
function stringify(type: "video", data: VideoData): string;
function stringify(type: "text", data: TextData): string;
function stringify(type: "application", data: ApplicationData): string;
function stringify(
  type: "image" | "video" | "text" | "application",
  data: FileData
) {
  const encodingVersion = "0";

  const encodedType = {
    image: "0",
    video: "1",
    text: "2",
    application: "3",
  }[type];

  let name = encodingVersion;
  name += encodedType;

  let flags = 0;

  // up to 10 flags

  const isPrivate = true;
  flags |= isPrivate ? 0 : 1;
  /*
  flags |= something ? 0 : 2;
  flags |= something ? 0 : 4;
  */

  name += flags.toString(36).padStart(2, "0");

  name += Math.random().toString(36).slice(2, 10);

  const hasDimensions = (d: typeof data): d is ImageData | VideoData => {
    return type === "image" || type === "video";
  };

  const isVideo = (d: typeof data): d is VideoData => {
    return type === "video";
  };

  if (hasDimensions(data)) {
    name += data.width.toString(36).padStart(4, "0");
    name += data.height.toString(36).padStart(4, "0");
  } else {
    name += data.size.toString(36).padStart(8, "0");
  }

  if (isVideo(data)) {
    // name += data.framerate.toString(36).padStart(2, "0");
    name += data.duration.toString(36).padStart(4, "0");
  }

  return name;
}

const parse = (name: string) => {
  return {};
};

export const fileName = {
  stringify,
  parse,
};

export const getImageSize = (src: string) => {
  if (typeof document === "undefined") {
    throw new Error("getImageSize only works in a browser/DOM environment.");
  }
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      reject("image load timed out");
    }, 10000);
    img.onload = () => {
      clearTimeout(timer);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.src = src;
  });
};

export const getVideoSize = (src: string) => {
  if (typeof document === "undefined") {
    throw new Error("getVideoSize only works in a browser/DOM environment.");
  }
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const video = document.createElement("video");
    let timer: ReturnType<typeof setTimeout>;
    const onLoad = () => {
      video.removeEventListener("loadedmetadata", onLoad);
      clearTimeout(timer);
      resolve({ width: video.videoHeight, height: video.videoWidth });
    };
    timer = setTimeout(() => {
      video.removeEventListener("loadedmetadata", onLoad);
      reject("image load timed out");
    }, 10000);
    video.addEventListener("loadedmetadata", onLoad, false);
    video.src = src;
  });
};

export const getFileType = (fileType: string) => {
  const type = fileType.split("/")[0];
  if (["video", "image", "application"].includes(type)) return type;
  return null;
};

const files = {
  image: ["png", "jpg", "jpeg", "avif", "webp"],
  video: ["mp4", "mov", "wmv", "flv", "avi"],
  application: ["pdf"],
};

export const getFileTypeFromExtension = (extension: string) => {
  return (
    Object.entries(files).find(([, value]) => value.includes(extension))?.[0] ??
    null
  );
};

export const getFileExtension = (fileName: string) => {
  const extension = fileName.replace(/.*\.([^.]+)$/, "$1");
  if (!Object.values(files).flat(1).includes(extension)) return null;
  return extension;
};
