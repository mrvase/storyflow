import { createAuthenticator } from "@storyflow/auth";
import { createSessionStorage } from "@storyflow/session/src/sessionStorageEdge";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { cookieOptions } from "./server/cookieOptions";
import { User } from "./types";

export const config = {
  matcher:
    "/((?!index|public|static|api|_next|favicon.ico|sw.js|logout|registrer|verify|priser|dashboard\\/assets|dashboard\\/favicon.ico).+)",
};

const sessionStorage = createSessionStorage({
  cookie: cookieOptions,
});

export default async function middleware(req: NextRequest) {
  const page = req.nextUrl.pathname.split("/")[1];

  const auth = createAuthenticator<User>([], sessionStorage);

  const user = await auth.isAuthenticated(req);

  if (page === "bruger") {
    if (!user) {
      return NextResponse.redirect(new URL(`/login`, req.url));
    }

    if (req.headers.has("x-rewritten")) {
      return;
    }

    const url = new URL(req.nextUrl);
    url.searchParams.set("email", user.email);
    url.searchParams.set("name", user.name);
    url.searchParams.set(
      "orgs",
      user.organizations.map((el) => el.slug).join(",")
    );

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-rewritten", "true");
    return NextResponse.rewrite(url.toString(), {
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (page === "login") {
    if (user) {
      return NextResponse.redirect(new URL(`/bruger`, req.url));
    }

    return;
  }

  if (user) {
    const result = user.organizations.find((el) => el.slug === page);

    if (result && "permissions" in result && result.permissions !== false) {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-dashboard", "true");
      return NextResponse.rewrite(new URL(`/dashboard/index.html`, req.url), {
        request: {
          headers: requestHeaders,
        },
      });
    } else if (!result || !("permissions" in result)) {
      return NextResponse.redirect(new URL(`/verify?next=${page}`, req.url));
    }
  } else {
    return NextResponse.redirect(new URL(`/login?next=${page}`, req.url));
  }
  // will redirect to login from [slug] if no page is found.
}
