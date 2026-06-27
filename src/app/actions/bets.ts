"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function logBet(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const matchName = (formData.get("matchName") as string).trim();
  const bookmaker = (formData.get("bookmaker") as string).trim();
  const outcome   = (formData.get("outcome") as string).trim();
  const odds      = parseFloat(formData.get("odds") as string);
  const stake     = parseFloat(formData.get("stake") as string);
  const betType   = (formData.get("betType") as string) || "manual";
  const notes     = (formData.get("notes") as string | null)?.trim() || null;

  if (!matchName || !bookmaker || !outcome || isNaN(odds) || isNaN(stake)) return;

  await prisma.betLog.create({
    data: { userId: user.id, matchName, bookmaker, outcome, odds, stake, betType, notes },
  });

  revalidatePath("/bets");
}

export async function settleBet(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const id           = formData.get("id") as string;
  const result       = formData.get("result") as string;
  const closingRaw   = formData.get("closingOdds") as string | null;
  const closingOdds  = closingRaw && parseFloat(closingRaw) > 1 ? parseFloat(closingRaw) : null;

  const bet = await prisma.betLog.findUnique({ where: { id } });
  if (!bet || bet.userId !== user.id) return;

  const profit =
    result === "win"  ? Number(bet.stake) * (Number(bet.odds) - 1) :
    result === "lose" ? -Number(bet.stake) :
    null;

  await prisma.betLog.update({
    where: { id },
    data: { result, profit, settledAt: new Date(), ...(closingOdds !== null && { closingOdds }) },
  });

  revalidatePath("/bets");
}

export async function deleteBet(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const id = formData.get("id") as string;
  const bet = await prisma.betLog.findUnique({ where: { id } });
  if (!bet || bet.userId !== user.id) return;

  await prisma.betLog.delete({ where: { id } });
  revalidatePath("/bets");
}
