import { RenderHead } from "@storyflow/react";
import { request } from "./request";

export default async function Head({ params }: { params: any }) {
  const url = Object.values(params).join("/");
  const data = await request(url);

  return (
    <RenderHead
      data={data.head}
      transformTitle={(title) =>
        [title === "Forside" ? "" : title, "Storyflow"]
          .filter(Boolean)
          .join(" | ")
      }
    />
  );
}
