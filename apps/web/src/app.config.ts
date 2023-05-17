import { AppConfig, ApiConfig } from "@storyflow/api";
import { revalidatePath } from "next/cache";
import { configs } from "./components";

export const appConfig: AppConfig = {
  baseURL: process.env.BASE_URL as string,
  label: "storyflow.dk",
  configs,
  // namespaces: process.env.NAMESPACES?.split(",") ?? [],
};

export const apiConfig: ApiConfig = {
  mongoURL: process.env.MONGO_URL as string,
  publicKey: process.env.PUBLIC_KEY as string,
  storyflowKey: process.env.STORYFLOW_PUBLIC_KEY as string,
  cors:
    process.env.NODE_ENV === "development"
      ? ["http://localhost:5173", "http://localhost:3000"]
      : ["https://www.app.storyflow.dk"],
  revalidate: (path: string) => {
    revalidatePath(path);
  },
};
