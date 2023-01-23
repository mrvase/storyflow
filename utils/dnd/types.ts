export type Rect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  height: number;
  width: number;
};

export type Draggable = {
  identifier: Identifier;
  getBoundingClientRect: () => Rect;
  canReceive: CanReceive;
  disabled: boolean;
};

export type Item = any;

export type DragResultAction =
  | { type: "add"; index: number; item: any }
  | { type: "delete"; index: number };

export type OnChange = (actions: DragResultAction[]) => void;

export type List = {
  id: string;
  uniqueId: string;
  type: string;
  onChange: OnChange;
};

export type Identifier = {
  type: string;
  uniqueId: string;
  id: string | null;
  index: number | null;
  uniqueListId: string | null;
};

export type CanReceive = {
  link: (source: { type: string; item: any }) => "accept" | "reject" | "ignore";
  move: (source: { type: string; item: any }) => "accept" | "ignore";
};
