import { z } from "zod";

export const ZodServerPackage = <T extends z.ZodType>(Operation: T) =>
  z.tuple([
    z.string(),
    z.union([z.string(), z.number()]).nullable(),
    z.number(),
    z.array(Operation),
  ]);

export const ZodDocumentOp = <T extends z.ZodType>(Action: T) =>
  z.tuple([z.string(), z.array(Action)]).rest(z.string());

export const ZodSplice = <T extends z.ZodType>(Action: T) =>
  z.object({
    index: z.number(),
    remove: z.number().optional(),
    insert: z.array(Action).optional(),
  });

export const ZodToggle = <T extends z.ZodType>(Value: T) =>
  z.object({
    name: z.string(),
    value: Value,
  });
