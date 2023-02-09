import { createAuthenticator } from "@storyflow/auth";
import { createSessionStorage } from "@storyflow/session/src/sessionStorageEdge";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { cookieOptions } from "api/cookie-options";
import { User } from "api/types";

export const config = {
  matcher:
    "/((?!index|public|static|api|_next|favicon.ico|sw.js|blog|priser|login|logout|opret-org|registrer|bruger|builder|viewer|verify|dashboard\\/assets).+)",
};

const sessionStorage = createSessionStorage({
  cookie: cookieOptions,
});

export default async function middleware(req: NextRequest) {
  const org = req.nextUrl.pathname.split("/")[1];

  console.log("MIDDLEWARE HIT", org);

  const auth = createAuthenticator<User>([], sessionStorage);

  const user = await auth.isAuthenticated(req);

  if (user) {
    const result = user.organizations.find((el) => el.slug === org);

    if (result && "permissions" in result && result.permissions !== false) {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-dashboard", "true");
      return NextResponse.rewrite(new URL(`/dashboard/index.html`, req.url), {
        request: {
          headers: requestHeaders,
        },
      });
    } else if (!result || !("permissions" in result)) {
      return NextResponse.redirect(new URL(`/verify?next=${org}`, req.url));
    }
  } else {
    return NextResponse.redirect(new URL(`/login?next=${org}`, req.url));
  }
  // will redirect to login from [slug] if no page is found.
}
