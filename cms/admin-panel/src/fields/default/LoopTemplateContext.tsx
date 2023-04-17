import { createStaticStore } from "../../state/StaticStore";

export const { useKey: useLoopTemplate } = createStaticStore<
  string,
  Map<string, string>
>(() => new Map());
