import { ClientPromise, createClient } from "./mongo";

let clientPromise: ClientPromise | null = null;

export const getClientPromise = () => {
  if (!clientPromise) {
    throw new Error("Mongo client not initialized");
  }
  return clientPromise;
};

export const setClientPromise = (url: string) => {
  if (clientPromise === null) {
    clientPromise = createClient(url);
  }
};
