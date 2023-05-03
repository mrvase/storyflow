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

export async function GET(request: NextRequest) {
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

  const user = {
    id: "test",
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

  return new Response(token);
}
