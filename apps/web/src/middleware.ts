import { createAuthenticator } from "@storyflow/auth";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { authOptions } from "./server/authOptions";
import { User } from "./types";

export const config = {
  matcher:
    "/((?!public|static|api|_next|login|logout|registrer|bruger|verify|dashboard|favicon.ico|sw.js).+)",
};

export default async function middleware(req: NextRequest) {
  const org = req.nextUrl.pathname.split("/")[1];

  const requestHeaders = new Headers(req.headers);

  const auth = createAuthenticator<User>([], authOptions);

  const user = await auth.isAuthenticated(req);

  console.log("MIDDLEWARE USER", org, user);

  if (user) {
    const result = user.organizations.find((el) => el.slug === org);

    if (result && "permissions" in result && result.permissions !== false) {
      requestHeaders.set("x-dashboard", "true");

      const res = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      console.log("SUCCESS");
      return res;
    } else if (!result || !("permissions" in result)) {
      return NextResponse.redirect(new URL(`/verify?next=${org}`, req.url));
    }
  }
  // will redirect to login from [slug] if no page is found.
}
