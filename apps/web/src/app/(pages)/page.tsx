import { RenderPage } from "@storyflow/react/rsc";
import { configs, libraries } from "../../components";
import { getPage } from "./localApi";

export default async function Page({ params }: { params: any }) {
  const url = Object.values(params).join("/");
  const data = await getPage(`/${url}`); // await request(url, options);

  return (
    <RenderPage data={data?.page} configs={configs} libraries={libraries} />
  );
}

export const dynamicParams = false;
