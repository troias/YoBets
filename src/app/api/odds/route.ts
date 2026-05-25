import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { sampleOddsRows } from "@/lib/mock-data";
import { parsePagination } from "@/lib/validation/common";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-forwarded-for") ?? "local";
  const gate = rateLimit(`odds:${key}`);

  if (!gate.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { page, pageSize, sortBy, order } = parsePagination(req.nextUrl.searchParams);
  const sorted = [...sampleOddsRows].sort((a, b) => {
    const av = a[sortBy as keyof typeof a] ?? 0;
    const bv = b[sortBy as keyof typeof b] ?? 0;
    return order === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const start = (page - 1) * pageSize;
  return NextResponse.json({ data: sorted.slice(start, start + pageSize), page, pageSize, total: sorted.length });
}
