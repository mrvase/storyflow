export const createChangeDebugger = () => {
  let memo = new Map<string, any[]>();
  return (name: string, ...args: any[]) => {
    const prev = memo.get(name);
    if (
      !prev ||
      prev.length !== args.length ||
      prev.some((el, i) => el !== args[i])
    ) {
      console.log(`%c${name}`, "background:#0f0;", prev, args);
    }
    memo.set(name, args);
  };
};
