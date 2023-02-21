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
};

export type PropConfig = {
  name: string;
  type: keyof PropTypes;
  label: string;
  defaultValue?: any;
  searchable?: boolean;
  options?: any[] | readonly any[] | Record<string, PartialConfig>;
};

export type PropGroup = {
  name: string;
  type: "group";
  label: string;
  props: readonly PropConfig[];
  searchable?: boolean;
};

export type PropConfigArray = readonly (PropConfig | PropGroup)[];

type NameToType<
  Ps extends PropConfigArray,
  Prop extends Ps[number],
  Name extends Ps[number]["name"]
> = Prop extends { type: "group"; name: Name }
  ? Props<Prop["props"]>
  : Prop extends { type: keyof PropTypes; name: Name }
  ? PropTypes[Prop["type"]]
  : never;

type AddConfigAsChild<A> = {
  [Key in keyof A]: A[Key] extends PropTypes["children"]
    ? (
        | A[Key][number]
        | ExtendedPartialConfig<any>
        | {
            config: ExtendedPartialConfig<any>;
            story: StoryConfig<any>;
          }
      )[]
    : A[Key];
};

type Props<T extends PropConfigArray> = {
  [Key in T[number]["name"]]: NameToType<T, T[number], Key>;
};

export type StoryProps<T extends PropConfigArray> = Partial<
  AddConfigAsChild<Props<T>>
>;

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

export type ExtendedPartialConfig<T extends PropConfigArray> =
  PartialConfig<T> & {
    component: ComponentType<Props<T>>;
  };

export type ExtendedLibraryConfig = {
  name: string;
  label: string;
  components: Record<string, ExtendedPartialConfig<any>>;
};

export type ComponentConfigRecord = {
  [name: string]: ComponentConfig;
};

export type ComponentRecord = {
  [name: string]: Component<any>;
};

export type LibraryConfig = {
  name: string;
  label: string;
  components: Record<string, ComponentConfig>;
};

export type Library<Config extends LibraryConfig = LibraryConfig> = {
  name: Config["name"];
  components: {
    [Key in keyof Config["components"]]: Component<Config["components"][Key]>;
  };
};

export type ClientConfig = {
  builderUrl: string;
  revalidateUrl: string;
  libraries: LibraryConfig[];
};

export type PathSegment = {
  id: string;
  label: string;
  parentProp: { name: string; label: string } | null;
};

export type Path = PathSegment[];

export type BuilderSelection = {
  path: string;
  type: string;
};

export type LayoutElement = {
  id: string;
  type: string;
  props: Record<string, any>;
  parent?: string;
};

export type NestedDocument = {
  id: string;
  values: Record<string, any>;
};

export type FileToken = {
  src: string;
};

export type ValueArray = (
  | string
  | number
  | boolean
  | LayoutElement
  | NestedDocument
  | FileToken
  | ValueArray
)[];

export type RenderArray = (
  | LayoutElement
  | { $text: (string | number | LayoutElement)[] }
  | { $heading: [number, string] }
)[];

export type ComponentProps<C extends ComponentConfig | PartialConfig> = {
  [Key in C["props"][number]["name"]]: NameToType<
    C["props"],
    C["props"][number],
    Key
  >;
};

export type Component<C extends ComponentConfig | PartialConfig> =
  ComponentType<ComponentProps<C>>;
