import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { route: string[] } }
) {
  const settings = {};

  return NextResponse.json(settings);
}
