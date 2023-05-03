import { config } from "./components";

type StoryflowConfigOptions = {
  baseURL: string;
  apiPath: string;
  public: {
    organization: string;
    key: string;
  };
  api: {
    admin: string;
    mongoURL: string;
  };
  apps: {
    slug: string;
    configURL: string;
  }[];
};

type AppConfigOptions = {
  baseURL: string;
  label: string;
  builderPath: string;
  revalidatePath: string;
  libraries: any[];
};

const createStoryflowConfig = (options: StoryflowConfigOptions) => {
  return options;
};

const createAppConfig = (options: AppConfigOptions) => {
  return options;
};

export const generatePublicConfig = (options: StoryflowConfigOptions) => {
  return options.public;
};

export const StoryflowConfig = createStoryflowConfig({
  baseURL: "https://www.storyflow.dk",
  apiPath: "/_storyflow",
  public: {
    organization: "Semper",
    key: process.env.PUBLIC_KEY as string,
  },
  api: {
    admin: "martin@rvase.dk",
    mongoURL: "",
  },
  apps: [
    {
      slug: "web",
      configURL: "https://www.storyflow.dk/api/config",
    },
  ],
});

export const FrontendConfig = createAppConfig({
  baseURL: "https://www.storyflow.dk",
  label: "storyflow.dk",
  builderPath: "/builder",
  revalidatePath: "/api/revalidate",
  libraries: [config],
});
