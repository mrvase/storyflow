export type CollabRef = number;

export type CollabVersion = [index: number, prev: number, user: string] | [0];
export type VersionRecord = Record<string, CollabVersion>;

export type TimelineEntry = [
  queue: string,
  prev: CollabRef,
  user: string,
  ...transactions: Transaction<TransactionEntry>[]
];

export type Target = string;

export type SpliceOperation<Value = any> =
  | [index: number, remove: number, insert: Value[]]
  | [index: number, remove: number]
  | [index: number];

export type ToggleOperation<
  Type extends string = string,
  Value extends any = any
> = [type: Type, value: Value];

export type CustomOperation = object; // [name: string, value: any];

export type Operation = SpliceOperation | ToggleOperation | CustomOperation;

export type TransactionEntry<
  Key extends string = string,
  Op extends Operation = Operation
> = [Key, Op[]];

export type Transaction<T extends TransactionEntry = TransactionEntry> = T[];

export type QueueEntry<TE extends TransactionEntry = TransactionEntry> = {
  prev: CollabRef;
  user: string;
  queue: string;
  transaction: Transaction<TE>;
  transactionIndex: number | null;
  timelineIndex: number | null;
  trackers: WeakSet<object> | undefined;
};
