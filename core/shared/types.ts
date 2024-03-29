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

export type NestedAction = {
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
  insert: true;
  email: true;
  equals: true;
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
  file: string;
  number: number;
  boolean: boolean;
  children: (string | number | Element)[];
  date: Date;
  data: any[];
  action: string;
};

export type PropTypeKey = keyof DefaultPropTypes;

type GetPropType<T extends PropTypeKey> = T extends keyof PropTypes
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

export type PropInput = {
  type: "input";
  label: string;
  props?: Record<
    string,
    PropConfig<Exclude<keyof DefaultPropTypes, "children">>
  >;
};

export type PropConfigRecord = Record<
  string,
  PropConfig | PropGroup | PropInput
>;

type Type<T extends PropConfig | PropGroup | PropInput> = T extends {
  type: "group";
}
  ? NestedProps<T["props"]>
  : T extends { type: "input" }
  ? {
      name: string;
    } & (T extends { props: {} } ? NestedProps<T["props"]> : { label: string })
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

type PartialType<T extends PropConfig | PropGroup | PropInput> = T extends {
  type: "group";
}
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

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "color"
  | "image"
  | "video"
  | "file"
  | "children"
  | "data"
  | "action";

export type CollectionField = {
  name: string;
  label: string;
  type: FieldType;
  isArray?: boolean;
  hidden?: boolean;
  useAsTitle?: boolean;
};

type CollectionFieldToType<T extends CollectionField> = T extends {
  isArray: true;
}
  ? DefaultPropTypes[T["type"]][]
  : DefaultPropTypes[T["type"]];

type CollectionRecord<TFields extends TemplateFields | undefined> =
  TFields extends TemplateFields
    ? {
        [Key in TFields[number]["name"]]: CollectionFieldToType<
          Extract<TFields[number], { name: Key }>
        >;
      }
    : any;

export type Template = {
  name: string;
  label: string;
  fields: TemplateFields;
};

export type TemplateFields = readonly CollectionField[];

export type Collection<TFields extends TemplateFields | undefined = undefined> =
  CollectionInner<TFields, CollectionRecord<TFields>>;

export type CollectionInner<
  TFields extends TemplateFields | undefined = undefined,
  TData = any
> = {
  name: string;
  label: string;
  template?: TFields extends TemplateFields
    ? TFields
    : TemplateFields | undefined;
  externalData?: {
    readOne: (input: { id: string }) => Promise<TData>;
    readMany: (input: {
      filters: Partial<TData>;
      limit: number;
      offset: number;
      sort?: Record<string, 1 | -1>;
    }) => Promise<TData[]>;
    create?: (input: { id: string; data: TData }) => Promise<TData>;
    update?: (input: {
      id: string;
      data: Partial<TData>;
      doc: TData;
    }) => Promise<TData>;
    deleteMany?: (input: { ids: string[] }) => Promise<void>;
  };
  hooks?: {
    onCreate?: (
      options: { id: string; data: TData },
      create: (options: {
        id: string;
        data: TData;
      }) => Promise<{ id: string; data: TData; metadata: any }>
    ) => Promise<{ id: string; data: TData; metadata: any }>;
    onUpdate?: (
      options: {
        id: string;
        data: Partial<TData>;
      } & {
        doc: TData;
      },
      update: (options: {
        id: string;
        data: Partial<TData>;
      }) => Promise<{ id: string; data: TData; metadata: any }>
    ) => Promise<{ id: string; data: TData; metadata: any }>;
    onDelete?: (
      options: { id: string },
      remove: (options: { id: string }) => Promise<void>
    ) => Promise<void>;
    onReadOne?: (
      options: { id: string },
      read: (options: {
        id: string;
      }) => Promise<{ id: string; data: TData; metadata: any }>
    ) => Promise<{ id: string; data: TData; metadata: any }>;
    onReadMany?: (
      options: {
        filters: Partial<TData>;
        limit: number;
        offset: number;
        sort?: Record<string, 1 | -1>;
      },
      read: (options: {
        filters: Partial<TData>;
        limit: number;
        offset: number;
        sort?: Record<string, 1 | -1>;
      }) => Promise<{ id: string; data: TData; metadata: any }[]>
    ) => Promise<{ id: string; data: TData; metadata: any }[]>;
  };
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
  collections?: Collection[];
  templates?: Template[];
  allowUploads?: boolean;
  sendEmail?: (options: {
    from: string;
    to: string;
    subject: string;
    body:
      | string
      | {
          entry: ValueArray | ClientSyntaxTree;
          record: Record<FieldId, ValueArray | ClientSyntaxTree>;
        };
  }) => Promise<void>;
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
  mainBaseURL: string;
  label: string;
  builderPath?: string;
  configs: Record<string, LibraryConfig>;
  namespaces?: string[];
};

export type ApiConfig = BasicApiConfig & {
  revalidate?: (path: string) => void;
  createLoopComponent?: (arg: {
    id: NestedDocumentId;
    record: Record<string, ValueArray | ClientSyntaxTree> | null;
    options: string[];
  }) => object | null;
};
