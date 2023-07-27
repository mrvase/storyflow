"use server";

import { createAction } from "@storyflow/react/rsc";
import { getLoopWithOffset } from "./localApi";
import { configs, libraries, transforms } from "../../components";

export const action = createAction(getLoopWithOffset, {
  configs,
  libraries,
  transforms,
});
