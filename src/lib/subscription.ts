import prisma from "@/lib/prisma";

export type SubStatus = "active" | "trialing" | "past_due" | "canceled" | "inactive";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

export function isAdminEmail(email: string | undefined | null): boolean {
  return Boolean(ADMIN_EMAIL && email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
}

export async function getSubscriptionStatus(userId: string): Promise<SubStatus> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true },
  });
  if (!sub) return "inactive";
  return sub.status as SubStatus;
}

export function isSubscribed(status: SubStatus): boolean {
  return status === "active" || status === "trialing";
}
