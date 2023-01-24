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
