import { NextRequest, NextResponse } from "next/server";
import { resolveGeoLocation } from "@/lib/geo-service";

export async function GET(request: NextRequest) {
  return NextResponse.json(await resolveGeoLocation(request.headers));
}

