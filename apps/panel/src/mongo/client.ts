import { MongoClient, MongoClientOptions } from "mongodb";

let mongoClient: MongoClient;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
  var _mongoClientPromise: Promise<MongoClient>;
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
      mongoClient = new MongoClient(uri, options);
      global._mongoClientPromise = mongoClient.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    // In production mode, it's best to not use a global variable.
    mongoClient = new MongoClient(uri, options);
    clientPromise = mongoClient.connect();
  }

  return clientPromise;
};

export const client = {
  async get(string?: string) {
    if (!clientPromise) {
      throw new Error("Mongo client not initialized");
    }
    return (await clientPromise).db(string);
  },
  set(url: string) {
    if (clientPromise === null) {
      createClient(url);
    }
  },
};
