import { RenderHead } from "@storyflow/react";
import { request } from "@storyflow/react/rsc";
import { options } from "./options";

export default async function Head({ params }: { params: any }) {
  const url = Object.values(params).join("/");
  const data = await request(url, options);

  return (
    <RenderHead
      data={data?.head}
      transformTitle={(title) =>
        [title === "Forside" ? "" : title, "Storyflow"]
          .filter(Boolean)
          .join(" | ")
      }
    />
  );
}
