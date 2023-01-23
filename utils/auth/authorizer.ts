import { Authenticator } from "./authenticator";
import type { Request } from "./strategy";
import { error, Result, success } from "@storyflow/result";

export function createAuthorizer<User = unknown, Data = unknown>(
  authenticator: Authenticator<User>
) {
  async function authorize(
    request: Request,
    args: { data?: Data } = {}
  ): Promise<Result<User>> {
    let user = await authenticator.isAuthenticated(request);

    if (!user) {
      return error({ status: 401, message: "Not authorized." });
    }

    return success(user);
  }
  return {
    authorize,
  };
}
