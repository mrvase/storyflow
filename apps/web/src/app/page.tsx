import { RenderPage } from "@storyflow/react";
import { request } from "./request";

export default async function Page({ params }: { params: any }) {
  const url = Object.values(params).join("/");
  const data = await request(url);

  return <RenderPage data={data?.page} />;
}
