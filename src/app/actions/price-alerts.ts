"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createPriceAlert(
  matchId: string,
  matchName: string,
  outcome: string,
  targetPrice: number,
): Promise<{ error?: string }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const existing = await prisma.priceAlert.findFirst({
    where: { userId: user.id, matchId, outcome, firedAt: null },
  });
  if (existing) {
    await prisma.priceAlert.update({
      where: { id: existing.id },
      data: { targetPrice },
    });
  } else {
    await prisma.priceAlert.create({
      data: { userId: user.id, matchId, outcome, targetPrice },
    });
  }

  revalidatePath("/nrl");
  revalidatePath("/settings");
  return {};
}

export async function deletePriceAlert(id: string): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await prisma.priceAlert.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/nrl");
  revalidatePath("/settings");
}

export async function getUserPriceAlerts() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  return prisma.priceAlert.findMany({
    where: { userId: user.id, firedAt: null },
    include: { match: { select: { homeTeam: true, awayTeam: true, kickoffAt: true } } },
    orderBy: { createdAt: "desc" },
  });
}
