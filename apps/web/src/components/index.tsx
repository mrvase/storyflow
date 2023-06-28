import {
  Library,
  LibraryConfig,
  LibraryConfigRecord,
  LibraryRecord,
  Transforms,
  extractLibrary,
} from "@storyflow/react";
import { ContentConfig } from "./Content";
import { LinkConfig } from "./Link";
import { HeaderConfig } from "./Header/Header";
import { NavConfig } from "./Nav";
import Image from "next/image";
import { OpenGraphConfig } from "./OpenGraph";
import { FormConfig } from "./Form";

const parseFileString = (value: string) => {
  if (!value) {
    return {
      src: "",
      width: 0,
      height: 0,
    };
  }

  const url = process.env.NEXT_PUBLIC_IMAGE_URL ?? "";
  const src = `${url}/${value}`;

  const width = parseInt(value.split("-")[4] ?? "0", 16);
  const height = parseInt(value.split("-")[5] ?? "0", 16);

  return {
    src,
    width,
    height,
  };
};

export const transforms = {
  image(value) {
    return parseFileString(value);
  },
  video(value) {
    return parseFileString(value);
  },
} satisfies Transforms;

declare module "@storyflow/react" {
  interface CustomTypes {
    CustomTransforms: typeof transforms;
  }
}

const kfs = {
  label: "KFS UI",
  configs: {
    FormConfig,
    ContentConfig,
    LinkConfig,
    HeaderConfig,
    NavConfig,
    OpenGraphConfig,
    ImageConfig: {
      label: "Billede",
      props: {
        image: {
          type: "image",
          label: "Billede",
        },
      },
      component: ({ image }) => {
        return (
          <Image
            src={image.src}
            width={image.width}
            height={image.height}
            alt=""
          />
        );
      },
    },
  },
} satisfies LibraryConfig;

export const configs = {
  kfs,
} satisfies LibraryConfigRecord;

const kfsLibrary = extractLibrary(kfs) satisfies Library<typeof kfs>;

export const libraries = {
  kfs: kfsLibrary,
} satisfies LibraryRecord<typeof configs>;
