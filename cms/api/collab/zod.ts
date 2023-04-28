import { z } from "zod";

export const ZodTimelineEntry = <T extends z.ZodType>(Transaction: T) =>
  z.tuple([z.number(), z.string(), z.string()]).rest(Transaction);

export const ZodTransaction = <T extends z.ZodType>(Operation: T) => {
  return z.array(z.tuple([z.string(), z.array(Operation)]));
};

export const ZodSpliceOperation = <T extends z.ZodType>(Value: T) =>
  z.tuple([z.number(), z.number()]).rest(Value);

export const ZodToggleOperation = <T extends z.ZodType>(Value: T) =>
  z.tuple([z.string(), Value]);
