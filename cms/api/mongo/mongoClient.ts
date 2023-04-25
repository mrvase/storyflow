import { createClient } from "@storyflow/db-core/mongo";

const MONGO_URL = process.env.MONGO_URL as string;

export const clientPromise = createClient(MONGO_URL);
