import { createHandler } from "@storyflow/api";
import { storyflowConfig } from "../../../../../storyflow.config";

export const { GET, POST, OPTIONS } = createHandler(storyflowConfig);

export const dynamic = "force-dynamic";
export const dynamicParams = true;
