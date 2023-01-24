export const extendPath = (old: string, add: string, spacer: string = ".") => {
  return [old, add].filter(Boolean).join(spacer);
};
