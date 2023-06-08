"use client";

import { RenderBuilder } from "@storyflow/react/builder";
import { configs, libraries, transforms } from "../../components";

export default function Page() {
  return (
    <RenderBuilder
      configs={configs}
      libraries={libraries}
      transforms={transforms}
    />
  );
}
