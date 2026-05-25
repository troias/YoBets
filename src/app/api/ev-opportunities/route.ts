import { NextRequest, NextResponse } from "next/server";
import { sampleOddsRows } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const minEv = Number(req.nextUrl.searchParams.get("minEv") ?? 0);
  const filtered = sampleOddsRows
    .filter((row) => row.evPercent >= minEv)
    .sort((a, b) => b.evPercent - a.evPercent);

  return NextResponse.json({ data: filtered });
}
