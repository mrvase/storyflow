import { RenderPage } from "@storyflow/react/rsc";
import { ImageResponse } from "next/server";
import { configs, libraries, transforms } from "../../components";
import { getPage } from "./localApi";

export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

export default async function og(props?: Record<string, any>) {
  const url = props?.params ? Object.values(props.params).join("/") : "/";
  const data = await getPage(`/${url}`);

  if (!data || !data.opengraph) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(
    (
      <RenderPage
        data={data.opengraph}
        configs={configs}
        libraries={libraries}
        transforms={transforms}
      />
    )
  );
}
