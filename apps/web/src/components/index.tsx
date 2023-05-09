import {
  Library,
  LibraryConfig,
  LibraryConfigRecord,
  LibraryRecord,
  extractLibrary,
} from "@storyflow/react";
import { ContentConfig } from "./Content";
import { LinkConfig } from "./Link";
import { HeaderConfig } from "./Header/Header";
import { NavConfig } from "./Nav";

const kfs = {
  label: "KFS UI",
  configs: {
    ContentConfig,
    LinkConfig,
    HeaderConfig,
    NavConfig,
  },
} satisfies LibraryConfig;

export const configs = {
  kfs,
} satisfies LibraryConfigRecord;

const kfsLibrary = extractLibrary(kfs) satisfies Library<typeof kfs>;

export const libraries = {
  kfs: kfsLibrary,
} satisfies LibraryRecord<typeof configs>;
