import {
  LibraryConfig,
  Library,
  CustomTransforms,
  Context,
  NestedDocumentId,
} from "@storyflow/shared/types";

type ComponentContext = {
  element: symbol;
  index: number;
  serverContexts: Context[];
};

export type RSCContext = {
  loopIndexRecord: Record<string, number>;
  contexts: ComponentContext[];
  // user-defined configs
  configs: Record<string, LibraryConfig>;
  libraries: Record<string, Library>;
  transforms: CustomTransforms;
  action?: (
    id: NestedDocumentId,
    options: string[]
  ) => Promise<React.ReactElement[] | null>;
  // settings
  isOpenGraph: boolean;
  // contains the page to be rendered at the outlet in the layout
  children: React.ReactNode;
};
