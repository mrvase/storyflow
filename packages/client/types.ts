import type {
  FileToken,
  NestedElement,
  ValueArray,
} from "@storyflow/shared/types";

export type RenderElement =
  | NestedElement
  | FileToken
  | { $text: (string | number | NestedElement)[] }
  | { $heading: [number, string] };

export type RenderArray = (RenderElement | { $children: RenderElement[] })[];

/* METADATA */

type Twitter = {
  cardType?: string;
  site?: string;
  handle?: string;
};

type Facebook = {
  appId?: string;
};

type OpenGraph = {
  title?: string;
  description?: string;
  type?: string;
  site_name?: string;
  url?: string;
  images?: OpenGraphMedia[];
  videos?: OpenGraphMedia[];
};

type OpenGraphMedia = {
  url?: string;
  secure_url?: string;
  type?: string;
  width?: string;
  height?: string;
  alt?: string;
};

type Alternate = {
  href: string;
  hrefLang: string;
};

type Robots = {
  noindex?: boolean;
  nofollow?: boolean;
  nosnippet?: boolean;
  noarchive?: boolean;
  noimageindex?: boolean;
  notranslate?: boolean;
};

export type Metadata = {
  title?: string;
  description?: string;
  canonical?: string;
  twitter?: Twitter;
  facebook?: Facebook;
  openGraph?: OpenGraph;
  alternates?: Alternate[];
  robots?: Robots;
};

export type FetchPageResult = {
  page: {
    entry: ValueArray;
    record: Record<string, ValueArray>;
  } | null;
  layout: {
    entry: ValueArray;
    record: Record<string, ValueArray>;
  } | null;
  head: Metadata;
};

export type ResolvedFetchPageResult = {
  page: RenderArray | null;
  layout: RenderArray | null;
  head: Metadata;
  imageUrl: string;
};
