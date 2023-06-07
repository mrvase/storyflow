import { ObjectId } from "mongodb";

export const createObjectId = (id: string) => new ObjectId(id);
export const isObjectId = (id: unknown): id is ObjectId =>
  id instanceof ObjectId;
