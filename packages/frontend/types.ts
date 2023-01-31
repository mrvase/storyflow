export interface ComponentType<P extends Props<ComponentConfig>> {
  (value: P): any;
}

type PropTypes = {
  string: string;
  image: {
    url: string;
    width: number;
    height: number;
  };
  number: number;
  boolean: boolean;
  children: any[];
};

export type PropConfig = {
  name: string;
  type: keyof PropTypes;
  label: string;
  defaultValue?: any;
  searchable?: boolean;
  options?: any[] | readonly any[] | Record<string, PartialConfig>;
};

type NameToType2<
  Props extends readonly PropConfig[],
  Prop extends Props[number],
  Name extends Props[number]["name"]
> = Prop extends { name: Name } ? PropTypes[Prop["type"]] : never;

type Props2<T extends readonly PropConfig[]> = {
  [Key in T[number]["name"]]: NameToType2<T, T[number], Key>;
};

type StoryConfig<T extends readonly PropConfig[]> = {
  label?: string;
  canvas?: string;
  props: Partial<Props2<T>>;
};

export type Story = {
  name: string;
  label: string;
  canvas: string;
  page: any[];
};

export type ComponentConfig<
  T extends readonly PropConfig[] = readonly PropConfig[]
> = {
  name: string;
  label: string;
  inline?: boolean;
  hidden?: boolean;
  props: T;
  stories?: StoryConfig<T>[];
};

export type PartialConfig<
  T extends readonly PropConfig[] = readonly PropConfig[]
> = {
  name?: string;
  typespace?: string;
  label?: string;
  inline?: boolean;
  hidden?: boolean;
  props: T;
  stories?: StoryConfig<T>[];
};

export type ExtendedPartialConfig<T extends readonly PropConfig[]> =
  PartialConfig<T> & {
    component: ComponentType<T extends any[] ? Props2<T> : any>;
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

export type ValueArray = (
  | string
  | number
  | boolean
  | LayoutElement
  | NestedDocument
)[];

type NameToType<
  C extends ComponentConfig | PartialConfig,
  Prop extends C["props"][number],
  Name extends C["props"][number]["name"]
> = Prop extends { name: Name } ? PropTypes[Prop["type"]] : never;

export type Props<C extends ComponentConfig | PartialConfig> = {
  [Key in C["props"][number]["name"]]: NameToType<C, C["props"][number], Key>;
};

export type Component<C extends ComponentConfig | PartialConfig> =
  ComponentType<Props<C>>;
