import { StoryflowConfig } from "@storyflow/api";

export const storyflowConfig: StoryflowConfig = {
  baseURL: process.env.BASE_URL as string,
  public: {
    organization: "Semper",
    publicKey: process.env.PUBLIC_KEY as string,
  },
  auth: {
    admin: "martin@rvase.dk",
    secret: process.env.SECRET_KEY as string,
    privateKey: process.env.PRIVATE_KEY as string,
  },
  api: {
    mongoURL: process.env.MONGO_URL as string,
    storyflowKey: process.env.STORYFLOW_PUBLIC_KEY as string,
    cors:
      process.env.NODE_ENV === "development"
        ? ["http://localhost:5173"]
        : ["https://www.app.storyflow.dk"],
  },
  apps: [
    {
      name: "web",
      baseURL: process.env.BASE_URL as string,
    },
  ],
  workspaces: [
    {
      name: "w080",
    },
  ],
};
