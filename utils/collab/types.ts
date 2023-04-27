export type TimelineEntry = [
  prev: number,
  user: string,
  queue: string,
  ...transactions: Transaction<TransactionEntry>[]
];

export type Target = string;

export type SpliceOperation<Value = any> = [
  index: number,
  remove: number,
  ...inserts: Value[]
];

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
  prev: number;
  user: string;
  queue: string;
  transaction: Transaction<TE>;
  transactionIndex: number;
  timelineIndex: number | null;
  tracker: object | undefined;
};
