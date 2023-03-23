import "../styles.css";
import React from "react";
import { RenderLayout, request } from "@storyflow/react/rsc";
import { options } from "./options";
import { config, library } from "../components";
import { registerLibraries, registerLibraryConfigs } from "@storyflow/react";

registerLibraries([library]);
registerLibraryConfigs([config]);

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: any;
}) {
  const url = Object.values(params).join("/");
  const data = await request(url, options);

  console.log("LAYOUT", data?.layout);

  const content = <RenderLayout data={data?.layout}>{children}</RenderLayout>;

  if (url === "") {
    return (
      <html>
        <head />
        <body>{content}</body>
      </html>
    );
  }

  return content;
}
