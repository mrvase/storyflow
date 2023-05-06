import { AppConfig, StoryflowConfig } from "@storyflow/api";
import { config } from "./components";

export const storyflowConfig: StoryflowConfig = {
  baseURL: "https://www.storyflow.dk",
  public: {
    organization: "Semper",
    publicKey: process.env.PUBLIC_KEY as string,
  },
  api: {
    admin: "martin@rvase.dk",
    mongoURL: process.env.MONGO_URL as string,
    privateKey: process.env.PRIVATE_KEY as string,
    storyflowKey: process.env.STORYFLOW_PUBLIC_KEY as string,
  },
  apps: [
    {
      name: "web",
      configURL: `${process.env.BASE_URL}/api/config`,
    },
  ],
  workspaces: [
    {
      name: "w080",
      db: "dashboard-w080",
    },
  ],
};

export const appConfig: AppConfig = {
  baseURL: process.env.BASE_URL as string,
  label: "storyflow.dk",
  builderPath: "/builder",
  revalidatePath: "/api/revalidate",
  libraries: [config],
};
