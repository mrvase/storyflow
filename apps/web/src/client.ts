import { createClient } from "@sfrpc/client";
import type {} from "@sfrpc/types";
import type {} from "@storyflow/result";
import type { UserAPI } from "api/users";

// export const client = createClient<API>();
export const client = createClient<UserAPI>(`/api`);
