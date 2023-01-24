import { isError, Result } from "@storyflow/result";
import { Queue, unwrapServerPackage } from "@storyflow/state";

const intervals: Record<string, number | null> = {};

export const retryOnError = (
  id: string,
  callback: () => Promise<Result<any>>
) => {
  const run = async () => {
    const result = await callback();
    if (isError(result) && !intervals[id]) {
      intervals[id] = window.setInterval(() => run(), 2500);
    } else if (!isError(result) && intervals[id]) {
      window.clearInterval(intervals[id]!);
      intervals[id] = null;
    }
  };
  return run();
};

export const pushAndRetry = <T extends object>(
  id: string,
  operation: T,
  mutate: any,
  queue: Queue<T>
) => {
  queue.push(operation);
  retryOnError(
    id,
    () =>
      new Promise((res) => {
        queue.sync(async (pkg) => {
          const result = await mutate(unwrapServerPackage(pkg).operations);
          res(result);
          if (isError(result)) {
            return false;
          }
          return [];
        });
      })
  );
};
