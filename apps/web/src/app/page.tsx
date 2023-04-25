import { RenderPage, request } from "@storyflow/react/rsc";
import { options } from "./options";
import { config, library } from "../components";
import { registerLibraries, registerLibraryConfigs } from "@storyflow/react";
import { getPage } from "./api";

registerLibraries([library]);
registerLibraryConfigs([config]);

export default async function Page({ params }: { params: any }) {
  const url = Object.values(params).join("/");
  const data = await getPage(url); // await request(url, options);

  return <RenderPage data={data?.page} />;
}

export const dynamicParams = false;
