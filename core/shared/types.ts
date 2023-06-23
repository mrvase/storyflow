declare const brand: unique symbol;

export type Brand<T, TBrand extends string> = T & { [brand]: TBrand };

export type ExtractBrandedType<BrandedType> = BrandedType extends Brand<
  any,
  infer TBrand
>
  ? TBrand
  : never;

export type RawDocumentId = Brand<string, "raw-document-id">;
export type RawFieldId = Brand<string, "raw-field-id">;
export type DocumentId = Brand<string, "document-id">;
export type NestedDocumentId = Brand<string, "nested-document-id">;
export type FieldId = Brand<string, "field-id">;
export type RawFolderId = Brand<string, "raw-folder-id">;
export type FolderId = Brand<string, "folder-id">;

export type PrimitiveValue = string | number | boolean;

export type NestedElement = {
  id: NestedDocumentId;
  element: string;
  // props: Record<RawFieldId, true>; // searchable props
  inline?: true;
};

export type NestedFolder = {
  id: NestedDocumentId;
  folder: FolderId;
  inline?: true;
};

export type NestedDocument = {
  id: DocumentId | NestedDocumentId;
  inline?: true;
};

export type NestedEntity = NestedElement | NestedFolder | NestedDocument;

export type ContextToken = {
  ctx: string; // server side ctx, e.g. url
};

export type StateToken = {
  state: FieldId; // client side ctx
};

export type FileToken = {
  src: string;
};

export type ColorToken = {
  color: string;
};

export type DateToken = {
  date: string;
};

export type CustomToken = {
  name: string;
};

export type Token =
  | CustomToken
  | ContextToken
  | FileToken
  | ColorToken
  | StateToken
  | DateToken;

export type Value = PrimitiveValue | Token | NestedEntity;

export type Nested<T> = T | Nested<T>[];

export type ValueArray = Nested<Value>[];

export const operators = [
  "*",
  "+",
  "-",
  "/",
  "=",
  "<",
  ">",
  ">=",
  "<=",
  "&",
  "|",
] as const;

export type Sorting = `${"-" | "+"}${RawFieldId}`;

export type FunctionDataRecord = {
  if: true;
  in: true;
  concat: true;
  sum: true;
  filter: true;
  slug: true;
  url: true;
  root: true;
  merge: true;
  template: RawDocumentId;
  select: RawFieldId;
  loop: RawDocumentId;
  fetch: [limit: number, ...sortings: Sorting[]];
  to_date: true;
  to_file: true;
  to_boolean: true;
  to_color: true;
};

export type Operator = (typeof operators)[number];
export type FunctionName = keyof FunctionDataRecord;

export type ClientSyntaxTree = {
  type: Operator | FunctionName | "array" | null;
  children: (ClientSyntaxTree | ValueArray)[];
  data?: any;
  open?: true;
};

/*
FRONTEND
*/

export interface Component<P extends Config["props"]> {
  (props: Props<P> & {}): any;
}

type ExtendableTypes = "Element" | "CustomTransforms";

export interface CustomTypes {
  [key: string]: unknown;
}

type ExtendedType<K extends ExtendableTypes, B> = unknown extends CustomTypes[K]
  ? B
  : CustomTypes[K] extends B
  ? CustomTypes[K]
  : never;

export type Element = ExtendedType<"Element", object>;

export type CustomTransforms = ExtendedType<"CustomTransforms", {}>;

type PropTypes = PropTypesFromTransforms<CustomTransforms>;

export type Transforms = {
  [Key in keyof DefaultPropTypes]?: (value: DefaultPropTypes[Key]) => any;
};

export type PropTypesFromTransforms<T extends Transforms> = {
  [Key in keyof T as undefined extends T[Key] ? never : Key]: T[Key] extends (
    value: any
  ) => any
    ? ReturnType<T[Key]>
    : never;
};

type DefaultPropTypes = {
  string: string;
  color: string;
  image: string;
  video: string;
  number: number;
  boolean: boolean;
  children: (string | number | Element)[];
  date: Date;
  data: any[];
};

type GetPropType<T extends keyof DefaultPropTypes> = T extends keyof PropTypes
  ? PropTypes[T]
  : DefaultPropTypes[T];

export type Option = {
  value: string | number;
  label?: string;
  alias?: string;
};

export type PropConfig<PropType = keyof DefaultPropTypes> = {
  type: PropType;
  label: string;
  defaultValue?: any;
  searchable?: boolean;
  options?: Options;
};

export type Options =
  | (string | number | Option)[]
  | {
      [key: keyof ConfigRecord]: Config & { component: Config["component"] };
    };

export type PropGroup = {
  type: "group";
  label: string;
  props: Record<
    string,
    PropConfig<Exclude<keyof DefaultPropTypes, "children">>
  >;
  searchable?: boolean;
};

export type PropConfigRecord = Record<string, PropConfig | PropGroup>;

type Type<T extends PropConfig | PropGroup> = T extends { type: "group" }
  ? NestedProps<T["props"]>
  : T["type"] extends keyof DefaultPropTypes
  ? GetPropType<T["type"]>
  : never;

export type NestedProps<T extends PropConfigRecord> = string extends keyof T
  ? any
  : {
      [Key in keyof T]: Type<T[Key]>;
    } & {};

// The logic tests if the generic passed to props is just "PropConfigRecord" and not a more specific type.
// If it is the case, we get errors on configs in options, where we pass a component with very specific
// props to a type with general props. E.G.: "label" and "href" does not exists on Props<PropConfigRecord>.
export type Props<T extends PropConfigRecord> = NestedProps<T> & {
  useServerContext?: <Value>(config: ContextProvider<Value>) => Value;
} & {};

type Placeholders<T extends PropConfigRecord> = string extends keyof T
  ? any
  : {
      [Key in keyof T as T[Key] extends { type: "children" }
        ? never
        : Key]: T[Key] extends { type: "group" }
        ? Placeholders<T[Key]["props"]>
        : Placeholder<Type<T[Key]>>;
    };

type PartialType<T extends PropConfig | PropGroup> = T extends { type: "group" }
  ? PartialProps<T["props"]>
  : T["type"] extends keyof DefaultPropTypes
  ? GetPropType<T["type"]>
  : never;

export type PartialProps<T extends PropConfigRecord> = {
  [Key in keyof T]?: AddConfigAsChild<PartialType<T[Key]>>;
};

type AddConfigAsChild<A> = A extends GetPropType<"children">
  ? (
      | A[number]
      | Config
      | {
          config: Config;
          props?: PartialProps<Config["props"]>;
          story?: keyof Required<Config>["stories"];
        }
    )[]
  : A;

export type Story<T extends PropConfigRecord = PropConfigRecord> = {
  props: PartialProps<T>;
};

export type Stories<T extends PropConfigRecord> = Record<string, Story<T>>;

export declare const placeholder: unique symbol;
export type Placeholder<Type> = string & { [placeholder]: Type };

export const context = Symbol("context");

export type Context<Value = unknown> = { value: Value; [context]: symbol };

export type ContextProvider<Value = unknown> = ((
  value: Value
) => Context<Value>) & {
  defaultValue: Value;
  [context]: symbol;
};

export type Config<T extends PropConfigRecord = PropConfigRecord> = {
  label: string;
  props: T;
  stories?: Stories<T>;
  provideContext?:
    | Context
    | Context[]
    | ((props: Placeholders<T>) => Context | Context[]);
  inline?: boolean;
  hidden?: boolean;
  component?: Component<T>;
};

export type ConfigRecord<T extends PropConfigRecord = PropConfigRecord> = {
  [key: ConfigName<string>]: Config<T>;
};

type ConfigName<T extends string> = `${T}Config`;

type Name<T> = T extends ConfigName<infer U> ? U : T;

export type LibraryConfig = {
  label: string;
  configs: ConfigRecord;
};

export type Library<T extends LibraryConfig = LibraryConfig> = {
  [Key in keyof T["configs"] as Name<Key>]: Component<
    T["configs"][Key] extends { props: PropConfigRecord }
      ? T["configs"][Key]["props"]
      : never
  >;
};

export type LibraryConfigRecord = { [key: string]: LibraryConfig };

export type LibraryRecord<T extends LibraryConfigRecord = LibraryConfigRecord> =
  {
    [Key in keyof LibraryConfigRecord]: Library<T[Key]>;
  };

/*
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
  label?: string;
  typespace?: string;
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
*/

/* PATH */

export type PathSegment = string;
export type Path = PathSegment[];

/* */

type BasicApiConfig = {
  mongoURL: string;
  storyflowKey: string;
  publicKey: string;
  cors?: string[];
};

export type StoryflowConfig = {
  baseURL: string;
  public: {
    organization: string;
  };
  auth: {
    admin: string;
    secret: string;
    privateKey: string;
  };
  api: BasicApiConfig;
  workspaces: [WorkspaceReference, ...WorkspaceReference[]];
  apps: AppReference[];
};

export type WorkspaceReference = {
  name: string;
};

export type AppReference = {
  name: string;
  baseURL: string;
};

export type AppConfig = {
  baseURL: string;
  label: string;
  builderPath?: string;
  configs: Record<string, LibraryConfig>;
  namespaces?: string[];
};

export type ApiConfig = BasicApiConfig & {
  revalidate?: (path: string) => void;
};
