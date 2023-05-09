import { AppConfig, ApiConfig } from "@storyflow/api";
import { revalidatePath } from "next/cache";
import { configs } from "./components";

export const appConfig: AppConfig = {
  baseURL: process.env.BASE_URL as string,
  label: "storyflow.dk",
  configs,
  namespaces: process.env.NAMESPACES?.split(",") ?? [],
};

export const apiConfig: ApiConfig = {
  mongoURL: process.env.MONGO_URL as string,
  storyflowKey: process.env.STORYFLOW_PUBLIC_KEY as string,
  revalidate: (path: string) => {
    revalidatePath(path);
  },
};
