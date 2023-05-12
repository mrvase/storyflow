import { MongoClient, MongoClientOptions } from "mongodb";

let client;
let clientPromise: ClientPromise;

declare global {
  var _mongoClientPromise: ClientPromise;
}

export const createClient = (url: string) => {
  const uri = `${url}?retryWrites=true&w=majority`;

  const options: MongoClientOptions = {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 10000,
  };

  if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }

  return clientPromise;
};

export type ClientPromise = Promise<MongoClient>;
