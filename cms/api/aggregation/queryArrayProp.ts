export const queryArrayProp = <T extends Array<object>>(
  doc: T
): T extends Array<infer Element>
  ? {
      [Key in keyof Element]: Element[Key] extends any[]
        ? Element[Key]
        : Element[Key][];
    }
  : T => {
  return doc as any;
};
