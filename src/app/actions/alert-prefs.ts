"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function saveAlertPrefs(formData: FormData) {
  const user = await getUser();
  if (!user) return;

  const email            = (formData.get("email") as string | null)?.trim() || null;
  const phone            = (formData.get("phone") as string | null)?.trim() || null;
  const alertNewArb      = formData.get("alertNewArb") === "on";
  const minArbRoi        = Math.max(0, Number(formData.get("minArbRoi") ?? 0.5));
  const alertSteam       = formData.get("alertSteamMove") === "on";
  const steamThresh      = Math.max(0, Number(formData.get("steamMoveThreshold") ?? 10));
  const alertHighEv      = formData.get("alertHighEv") === "on";
  const minEv            = Math.max(0, Number(formData.get("minEvPercent") ?? 3));
  const alertHotBets     = formData.get("alertHotBets") === "on";
  const hotBetsThreshold = Math.max(0, Number(formData.get("hotBetsThreshold") ?? 15));
  const alertDailyDigest = formData.get("alertDailyDigest") === "on";
  const digestTime       = (formData.get("digestTime") as string | null)?.trim() || "09:00";

  const data = {
    email, phone,
    alertNewArb, minArbRoi,
    alertSteamMove: alertSteam, steamMoveThreshold: steamThresh,
    alertHighEv, minEvPercent: minEv,
    alertHotBets, hotBetsThreshold,
    alertDailyDigest, digestTime,
  };

  await prisma.alertPreferences.upsert({
    where:  { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });

  revalidatePath("/settings");
}

export async function addMatchAlert(formData: FormData) {
  const user = await getUser();
  if (!user) return;

  const matchId   = String(formData.get("matchId") ?? "").trim();
  const alertType = String(formData.get("alertType") ?? "").trim();
  const threshold = formData.get("threshold") ? Number(formData.get("threshold")) : null;

  if (!matchId || !alertType) return;

  await prisma.matchAlert.upsert({
    where:  { userId_matchId_alertType: { userId: user.id, matchId, alertType } },
    create: { userId: user.id, matchId, alertType, threshold },
    update: { threshold },
  });

  revalidatePath("/settings");
}

export async function deleteMatchAlert(id: string, _formData: FormData) {
  const user = await getUser();
  if (!user) return;
  await prisma.matchAlert.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/settings");
}
