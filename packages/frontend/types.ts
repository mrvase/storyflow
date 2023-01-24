export type PropConfig = {
  name: string;
  type: string;
  label: string;
  defaultValue?: any;
  searchable?: boolean;
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

export interface SharedComponentConfig {
  label?: string;
  isDefault?: boolean;
  isInline?: boolean;
  props: PropConfig[];
}

export type SharedComponentRecord = {
  [name: string]: SharedComponentConfig;
};

export type ClientConfig = { components: SharedComponentRecord };

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
