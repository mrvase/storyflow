export type PropConfig = {
  name: string;
  type: keyof PropTypes;
  label: string;
  defaultValue?: any;
  searchable?: boolean;
};

export type ComponentConfig = {
  name: string;
  label: string;
  isDefault?: boolean;
  isInline?: boolean;
  props: readonly PropConfig[];
};

export type ComponentConfigRecord = {
  [name: string]: ComponentConfig;
};

export type ComponentRecord = {
  [name: string]: Component<any>;
};

export type LibraryConfig = {
  label: string;
  name: string;
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

type PropTypes = {
  string: string;
  number: number;
  boolean: boolean;
  children: any[];
};

type NameToType<
  C extends ComponentConfig,
  Prop extends C["props"][number],
  Name extends C["props"][number]["name"]
> = Prop extends { name: Name } ? PropTypes[Prop["type"]] : never;

interface ComponentType<P extends Props<ComponentConfig>> {
  (value: P): any;
}

type Props<C extends ComponentConfig> = {
  [Key in C["props"][number]["name"]]: NameToType<C, C["props"][number], Key>;
};

export type Component<C extends ComponentConfig> = ComponentType<Props<C>>;
