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

export type PrimitiveValue = string | number | boolean | Date;

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

export type CustomToken = {
  name: string;
};

export type Token =
  | CustomToken
  | ContextToken
  | FileToken
  | ColorToken
  | StateToken;

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

export const functions = [
  "in",
  "concat",
  "sum",
  "filter",
  "slug",
  "url",
  "select",
  "loop",
  "root",
  "merge",
  "template",
  "fetch",
] as const;

export type Operator = (typeof operators)[number];
export type FunctionName = (typeof functions)[number];

export type ClientSyntaxTree = {
  type: Operator | FunctionName | "array" | null;
  children: (ClientSyntaxTree | ValueArray)[];
  data?: any;
  open?: true;
};

/*
FRONTEND
*/

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

/* PATH */

export type PathSegment = string;
export type Path = PathSegment[];

/* */

export type StoryflowConfig = {
  baseURL: string;
  public: {
    organization: string;
    key: string;
  };
  api: {
    admin: string;
    mongoURL: string;
  };
  workspaces: [WorkspaceReference, ...WorkspaceReference[]];
  apps: AppReference[];
};

export type WorkspaceReference = {
  name: string;
  db: string;
};

export type AppReference = {
  name: string;
  configURL: string;
};

export type AppConfig = {
  baseURL: string;
  label: string;
  builderPath: string;
  revalidatePath: string;
  libraries: LibraryConfig[];
};
