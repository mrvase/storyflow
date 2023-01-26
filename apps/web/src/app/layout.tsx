import "../styles.css";
import React from "react";
import { request } from "./request";
import { registerLibraries, RenderSingleLayout } from "@storyflow/react";
import { library } from "../components";

registerLibraries([library]);

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: any;
}) {
  const url = Object.values(params).join("/");
  const data = await request(url);

  const content = (
    <RenderSingleLayout data={data?.layout}>{children}</RenderSingleLayout>
  );

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

export const dynamic = "force-static";
export const dynamicParams = false;
