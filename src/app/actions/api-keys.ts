"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { randomBytes } from "crypto";

async function assertAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect("/dashboard");
  return user;
}

export async function createApiKey(formData: FormData) {
  await assertAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const key = "eb_" + randomBytes(24).toString("hex");
  await prisma.apiKey.create({ data: { name, key } });
}

export async function deleteApiKey(id: string, _formData: FormData) {
  await assertAdmin();
  await prisma.apiKey.delete({ where: { id } });
}

export async function upsertAppConfig(formData: FormData) {
  await assertAdmin();
  const label = String(formData.get("label") ?? "").trim();
  const key   = String(formData.get("key")   ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  if (!label || !key || !value) return;
  await prisma.appConfig.upsert({
    where: { key },
    create: { label, key, value },
    update: { label, value, updatedAt: new Date() },
  });
}

export async function deleteAppConfig(id: string, _formData: FormData) {
  await assertAdmin();
  await prisma.appConfig.delete({ where: { id } });
}

export async function setWorkerMode(formData: FormData) {
  await assertAdmin();
  const mode = String(formData.get("mode") ?? "").trim();
  if (!["production", "slow", "off"].includes(mode)) return;
  await prisma.appConfig.upsert({
    where:  { key: "worker_mode" },
    create: { label: "Worker Mode", key: "worker_mode", value: mode },
    update: { value: mode, updatedAt: new Date() },
  });
}
