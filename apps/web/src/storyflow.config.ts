import { StoryflowConfig } from "@storyflow/api";
import { Mailchimp } from "./collections/Mailchimp";
import { MailchimpLists } from "./collections/MailchimpLists";

export const storyflowConfig: StoryflowConfig = {
  baseURL: process.env.BASE_URL as string,
  public: {
    organization: "Semper",
  },
  auth: {
    admin: "martin@rvase.dk",
    secret: process.env.SECRET_KEY as string,
    privateKey: process.env.PRIVATE_KEY as string,
  },
  api: {
    mongoURL: process.env.MONGO_URL as string,
    publicKey: process.env.PUBLIC_KEY as string,
    storyflowKey: process.env.STORYFLOW_PUBLIC_KEY as string,
    cors:
      process.env.NODE_ENV === "development"
        ? ["http://localhost:3000"]
        : ["http://localhost:3000", "https://www.app.storyflow.dk"],
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
  collections: [MailchimpLists, Mailchimp],
  templates: [],
  allowUploads: true,
};

export default storyflowConfig;
