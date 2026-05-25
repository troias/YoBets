import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const alertSchema = z.object({
  type: z.string(),
  threshold: z.number().optional(),
  marketKey: z.string().optional(),
  channel: z.enum(["in_app", "email", "telegram", "discord"]).default("in_app"),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = alertSchema.parse(body);
  return NextResponse.json({ data: { id: crypto.randomUUID(), ...parsed, createdAt: new Date().toISOString() } }, { status: 201 });
}
