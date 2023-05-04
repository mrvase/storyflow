import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { StoryflowConfig } from "../../../config";

const parseKey = (key: string, type: "public" | "private") => {
  return (
    `-----BEGIN ${
      type === "public" ? "PUBLIC" : "ENCRYPTED PRIVATE"
    } KEY-----\n` +
    key.match(/.{1,64}/g)!.join("\n") +
    `\n-----END ${type === "public" ? "PUBLIC" : "ENCRYPTED PRIVATE"} KEY-----`
  );
};

export async function OPTIONS(request: NextRequest) {
  return new Response("", {
    status: 200,
    headers: {
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Encoding, X-Storyflow-Token",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": "http://localhost:5173",
    },
  });
}

export async function GET(request: NextRequest) {
  let headers = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Encoding, X-Storyflow-Token",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": request.headers.get("origin")!,
  };

  const cookie = request.cookies.get("sf.local.session");
  const header = request.headers.get("X-Storyflow-Token");

  const user = {
    email: "martin@rvase.dk",
  };

  const token = jwt.sign(
    user,
    {
      key: parseKey(process.env.PRIVATE_KEY as string, "private"),
      passphrase: "top secret",
    },
    {
      algorithm: "RS256",
      expiresIn: 60,
      issuer: StoryflowConfig.public.organization,
    }
  );

  if (cookie) {
    const user = JSON.parse(atob(cookie.value));
    headers["Set-Cookie"] = `sf.local.token=${token}; Path=/`;
  } else if (header) {
    const decoded = jwt.verify(
      header,
      parseKey(process.env.PUBLIC_KEY as string, "public"),
      {
        algorithms: ["RS256"],
        issuer: "storyflow",
      }
    );

    console.log("DECODED", decoded);
    headers["Set-Cookie"] = `sf.local.session=${btoa(
      JSON.stringify(user)
    )}; Path=/; HttpOnly; SameSite=Lax, sf.local.token=${token}; Path=/`;
  }

  return new Response("", {
    status: 200,
    headers,
  });

  // validate
  // look for http-only cookie
  // else: look for header and set http-only cookie
  // else: invalidated

  // get email -> check with db
  // if fine: return token

  /*
  const { searchParams } = new URL(request.url);
  const urlToken = searchParams.get("token");

  if (urlToken) {
    try {
      const decoded = jwt.verify(
        urlToken,
        parseKey(process.env.PUBLIC_KEY as string, "public"),
        {
          algorithms: ["RS256"],
          issuer: StoryflowConfig.public.organization,
        }
      );

      return NextResponse.json(decoded);
    } catch (err) {
      return NextResponse.json({ error: "expired" });
    }
  }
  */
}
