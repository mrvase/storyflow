import { NextRequest, NextResponse } from "next/server";
import { storyflowConfig } from "../../../config";

export async function GET(request: NextRequest) {
  console.log("RECIEVED REQUEST", request.headers.get("origin")!);
  return NextResponse.json(storyflowConfig.public, {
    headers: {
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Encoding, X-Storyflow-Token",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": request.headers.get("origin")!,
    },
  });
}
