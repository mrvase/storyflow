import { NextResponse } from "next/server";
import { StoryflowConfig, generatePublicConfig } from "../../../config";

export async function GET() {
  return NextResponse.json(generatePublicConfig(StoryflowConfig));
}
