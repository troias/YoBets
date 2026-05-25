import { NextResponse } from "next/server";
import { sampleArb } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ data: [sampleArb] });
}
