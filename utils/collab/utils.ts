import { TimelineEntry, QueueEntry } from "./types";

export const getId = (pkg: TimelineEntry | undefined) => {
  return pkg ? pkg.slice(0, 3).join("-") : null;
};

export const getTransactionId = (t: QueueEntry) => {
  return `${t.timelineIndex ?? ""}${t.prev}${t.queue}${t.transactionIndex}`;
};

export const createQueueFromTimeline = (
  shared: TimelineEntry[],
  next: TimelineEntry[]
): QueueEntry[] => {
  const queueEntries: QueueEntry[] = [];

  const addEntry = (el: TimelineEntry, timelineIndex: number | null) => {
    const metadata = {
      prev: el[0],
      user: el[1],
      queue: el[2],
      timelineIndex,
    };
    const [, , , ...transactions] = el;

    transactions.forEach((transaction, transactionIndex) => {
      queueEntries.push({
        ...metadata,
        transactionIndex,
        transaction,
        tracker: undefined,
      });
    });
  };

  shared.forEach(addEntry);
  next.forEach((el) => addEntry(el, null));

  return queueEntries;
};

export function filterTimeline(
  pkgs: TimelineEntry[],
  versions: Record<string, number>
) {
  const found = new Set<string>();
  return pkgs.filter((el) => {
    const queue = el[2];
    const index = el[0];
    const version = versions[queue];
    if (index === version) {
      found.add(queue);
    }
    return found.has(queue) && index >= version;
  });
}
