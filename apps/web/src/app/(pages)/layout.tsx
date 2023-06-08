import React from "react";
import { RenderLayout } from "@storyflow/react/rsc";
import { configs, libraries, transforms } from "../../components";
import { getPage } from "./localApi";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: any;
}) {
  const url = Object.values(params).join("/");
  const data = await getPage(`/${url}`);

  return (
    <RenderLayout
      data={data?.layout ?? null}
      configs={configs}
      libraries={libraries}
      transforms={transforms}
    >
      {children}
    </RenderLayout>
  );
}

export { metadata } from "../../metadata";
