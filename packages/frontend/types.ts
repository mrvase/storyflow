export interface ComponentType<P extends ComponentProps<ComponentConfig>> {
  (value: P): any;
}

type ExtendableTypes = "Element";

export interface CustomTypes {
  [key: string]: unknown;
}

type ExtendedType<K extends ExtendableTypes, B> = unknown extends CustomTypes[K]
  ? B
  : CustomTypes[K] extends B
  ? CustomTypes[K]
  : never;

export type Element = ExtendedType<"Element", object>;

type PropTypes = {
  string: string;
  color: string;
  image: {
    src: string;
    width: number;
    height: number;
  };
  video: {
    src: string;
    width: number;
    height: number;
  };
  number: number;
  boolean: boolean;
  children: (string | number | Element)[];
  data: any[];
};

export type Option =
  | string
  | number
  | ({
      label?: string;
    } & (
      | {
          value: string | number;
          name?: string;
        }
      | {
          name: string;
        }
    ));

export type PropConfig<Options extends AnyOptions = AnyOptions> = {
  name: string;
  type: keyof PropTypes;
  label: string;
  defaultValue?: any;
  searchable?: boolean;
  options?: Options;
};

export type RegularOptions = Option[] | readonly Option[];

export type ExtendedOptions =
  | Option[]
  | readonly Option[]
  | Record<string, { typespace?: string }>;

export type AnyOptions = RegularOptions | ExtendedOptions;

export type PropGroup<Options extends AnyOptions = AnyOptions> = {
  name: string;
  type: "group";
  label: string;
  props: readonly PropConfig<Options>[];
  searchable?: boolean;
};

export type PropConfigArray<Options extends AnyOptions = AnyOptions> =
  readonly (PropConfig<Options> | PropGroup<Options>)[];

type NameToType<
  Ps extends PropConfigArray,
  Prop extends Ps[number],
  Name extends Ps[number]["name"]
> = Prop extends { type: "group"; name: Name }
  ? Props<Prop["props"]>
  : Prop extends { type: keyof PropTypes; name: Name }
  ? PropTypes[Prop["type"]]
  : never;

type PartialNameToType<
  Ps extends PropConfigArray,
  Prop extends Ps[number],
  Name extends Ps[number]["name"]
> = Prop extends { type: "group"; name: Name }
  ? Partial<Props<Prop["props"]>>
  : Prop extends { type: keyof PropTypes; name: Name }
  ? PropTypes[Prop["type"]]
  : never;

type AddConfigAsChild<A> = A extends PropTypes["children"]
  ? (
      | A[number]
      | ExtendedPartialConfig<any>
      | {
          config: ExtendedPartialConfig<any>;
          story: StoryConfig<any>;
        }
    )[]
  : A;

type Props<T extends PropConfigArray> = {
  [Key in T[number]["name"]]: NameToType<T, T[number], Key>;
};

export type StoryProps<T extends PropConfigArray> = {
  [Key in T[number]["name"]]?: AddConfigAsChild<
    PartialNameToType<T, T[number], Key>
  >;
};

export type StoryConfig<T extends PropConfigArray> = {
  label?: string;
  canvas?: string;
  props: StoryProps<T>;
};

export type Story = {
  name: string;
  label: string;
  canvas: string;
  page: any[];
};

export type ComponentConfig<T extends PropConfigArray = PropConfigArray> = {
  name: string;
  label: string;
  inline?: boolean;
  hidden?: boolean;
  props: T;
  stories?: StoryConfig<T>[];
};

export type PartialConfig<T extends PropConfigArray = PropConfigArray> = {
  name?: string;
  typespace?: string;
  label?: string;
  inline?: boolean;
  hidden?: boolean;
  props: T;
  stories?: StoryConfig<T>[];
};

export type ExtendedPartialConfig<T extends PropConfigArray = PropConfigArray> =
  PartialConfig<T> & {
    component: ComponentType<Props<T>>;
  };

export type ExtendedLibraryConfig = {
  name: string;
  label: string;
  components: Record<string, ExtendedPartialConfig<PropConfigArray>>;
};

export type LibraryConfig = {
  name: string;
  label: string;
  components: Record<string, ComponentConfig<PropConfigArray<RegularOptions>>>;
};

export type Library<Config extends LibraryConfig = LibraryConfig> = {
  name: Config["name"];
  components: {
    [Key in keyof Config["components"]]: Component<Config["components"][Key]>;
  };
};

export type StoryLibrary = {
  name: string;
  components: Record<string, Story[]>;
};

export type ClientConfig = {
  builderUrl: string;
  revalidateUrl: string;
  libraries: LibraryConfig[];
};

export type PathSegment = string;

export type Path = PathSegment[];

export type BuilderSelection = {
  path: string;
  type: string;
};

export type NestedElement = {
  id: string;
  element: string;
  parent?: string;
};

export type NestedDocument = {
  id: string;
};

export type FileToken = {
  src: string;
};

export type ColorToken = {
  color: string;
};

export type CustomToken = {
  name: string;
};

export type ValueArray = (
  | string
  | number
  | boolean
  | Date
  | NestedElement
  | NestedDocument
  | FileToken
  | ColorToken
  | CustomToken
  | ValueArray
)[];

export type RenderElement =
  | NestedElement
  | { $text: (string | number | NestedElement)[] }
  | { $heading: [number, string] };

export type RenderArray = (RenderElement | { $children: RenderElement[] })[];

export type ComponentProps<C extends PartialConfig> = {
  [Key in C["props"][number]["name"]]: NameToType<
    C["props"],
    C["props"][number],
    Key
  >;
};

export type Component<C extends PartialConfig> = ComponentType<
  ComponentProps<C>
>;

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
