import { MongoClient } from "mongodb";

const MONGO_URL = process.env.MONGO_URL;

const uri = `${MONGO_URL}?retryWrites=true&w=majority` as string; // your mongodb connection string

const options = {};

export type ClientPromise = Promise<MongoClient>;

let client;
let clientPromise: ClientPromise;

declare global {
  var _mongoClientPromise: ClientPromise;
}

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

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;
