import { createRouteHandler } from "@storyflow/api";
import { storyflowConfig } from "../../../../storyflow.config";

export const { GET, POST, OPTIONS } = createRouteHandler(storyflowConfig);

export const dynamic = "force-dynamic";
export const dynamicParams = true;
