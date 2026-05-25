import { NextRequest, NextResponse } from "next/server";
import { parsePagination } from "@/lib/validation/common";

const events = [
  { id: "e1", sport: "NRL", league: "NRL", name: "Broncos vs Roosters", startsAt: new Date().toISOString() },
  { id: "e2", sport: "AFL", league: "AFL", name: "Swans vs Lions", startsAt: new Date().toISOString() },
];

export async function GET(req: NextRequest) {
  const { page, pageSize } = parsePagination(req.nextUrl.searchParams);
  const sport = req.nextUrl.searchParams.get("sport");
  const filtered = sport ? events.filter((event) => event.sport === sport) : events;
  const start = (page - 1) * pageSize;
  return NextResponse.json({ data: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize });
}
