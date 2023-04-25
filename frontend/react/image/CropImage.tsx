import React from "react";

type CropImageOptions = {
  width: number;
  height: number;
  aspect?: number;
  crop?: {
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
  };
  position?: {
    x?: number;
    y?: number;
  };
  fit?: "width" | "height";
};

type CropImageProps = {
  children: React.ReactElement;
  className?: string;
} & CropImageOptions;

const createCropImageStyles = ({
  width,
  height,
  aspect: frameAspect,
  fit,
  crop: { top = 0, left = 0, bottom = 1, right = 1 } = {},
  position: { x: adjustX = 0.5, y: adjustY = 0.5 } = {},
}: CropImageOptions) => {
  const rWidth = right - left;
  const rHeight = bottom - top;
  const imageAspect = (width / height) * (rWidth / rHeight);

  let scale = 1 / rWidth;
  let x = -1 * left;
  let y = -1 * top;

  if (frameAspect !== undefined) {
    if (imageAspect > frameAspect) {
      scale *= imageAspect / frameAspect;
      x -= (1 - frameAspect / imageAspect) * rWidth * adjustX;
    } else {
      y -= (1 - imageAspect / frameAspect) * rHeight * adjustY;
    }
  }

  const transform = [
    scale !== 1 && `scale(${scale})`,
    (x !== 0 || y !== 0) && `translate(${x * 100}%, ${y * 100}%)`,
  ]
    .filter(Boolean)
    .join(" ");

  const containerStyle = {
    ...(fit && {
      aspectRatio: frameAspect ?? imageAspect,
      [fit]: "100%",
    }),
    ...((transform || rHeight !== 1 || frameAspect !== imageAspect) && {
      aspectRatio: frameAspect ?? imageAspect,
      overflow: "hidden",
    }),
  };

  const imageStyle = {
    transform,
    ...(scale !== 1 && { transformOrigin: "top left" }),
    width: "100%",
    height: "auto",
  };

  return [containerStyle, imageStyle] as [
    typeof containerStyle,
    typeof imageStyle
  ];
};

export function CropImage({ className, children, ...props }: CropImageProps) {
  const [containerStyle, imageStyle] = createCropImageStyles(props);
  return (
    <div className={className} style={containerStyle}>
      {React.cloneElement(children, {
        style: imageStyle,
      })}
    </div>
  );
}
