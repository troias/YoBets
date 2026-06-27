import { Resend } from "resend";
import twilio from "twilio";
import webpush from "web-push";

const FROM_EMAIL = "EdgeBoard Alerts <alerts@edgeboard.com.au>";
const FROM_PHONE = process.env.TWILIO_PHONE_NUMBER ?? "";

function resendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

function twilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials not set");
  return twilio(sid, token);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await resendClient().emails.send({ from: FROM_EMAIL, to, subject, html });
}

export async function sendSms(to: string, body: string): Promise<void> {
  await twilioClient().messages.create({ from: FROM_PHONE, to, body });
}

export async function sendPush(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  title: string,
  body: string,
  url: string,
): Promise<void> {
  webpush.setVapidDetails(
    "mailto:alerts@edgeboard.com.au",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? "",
  );
  const payload = JSON.stringify({ title, body, url });
  await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
    )
  );
}

// ─── Alert message builders ──────────────────────────────────────────────────

export function arbAlertHtml(matchName: string, roi: number, legs: Array<{ bookmaker: string; outcome: string; odds: number; stake: number }>) {
  const legsHtml = legs
    .map(l => `<li>${l.bookmaker}: ${l.outcome} @ ${l.odds.toFixed(2)} — stake $${l.stake.toFixed(2)}</li>`)
    .join("");
  return `
    <h2 style="color:#4ade80">Arbitrage opportunity: +${roi.toFixed(2)}% ROI</h2>
    <p><strong>${matchName}</strong></p>
    <ul>${legsHtml}</ul>
    <p><a href="https://edgeboard.com.au/arbitrage">View on EdgeBoard →</a></p>
    <hr/>
    <p style="color:#888;font-size:12px">Gamble responsibly. <a href="https://www.gamblinghelponline.org.au">gamblinghelponline.org.au</a></p>
  `;
}

export function arbAlertSms(matchName: string, roi: number) {
  return `EdgeBoard Arb: ${matchName} +${roi.toFixed(2)}% ROI. edgeboard.com.au/arbitrage`;
}

export function steamAlertHtml(matchName: string, bookmaker: string, outcome: string, oldPrice: number, newPrice: number, changePct: number) {
  const dir = newPrice < oldPrice ? "⬇️ shortened" : "⬆️ drifted";
  return `
    <h2 style="color:#f59e0b">Steam move: ${bookmaker}</h2>
    <p><strong>${matchName}</strong></p>
    <p>${outcome} ${dir} from ${oldPrice.toFixed(2)} → ${newPrice.toFixed(2)} (${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}%)</p>
    <p><a href="https://edgeboard.com.au/line-movement">View line movement →</a></p>
    <hr/>
    <p style="color:#888;font-size:12px">Gamble responsibly. <a href="https://www.gamblinghelponline.org.au">gamblinghelponline.org.au</a></p>
  `;
}

export function steamAlertSms(matchName: string, bookmaker: string, outcome: string, oldPrice: number, newPrice: number) {
  const dir = newPrice < oldPrice ? "▼" : "▲";
  return `EdgeBoard Steam: ${bookmaker} ${outcome} ${dir} ${oldPrice.toFixed(2)}→${newPrice.toFixed(2)} (${matchName}). edgeboard.com.au/line-movement`;
}

export function evAlertHtml(matchName: string, bookmaker: string, outcome: string, offeredOdds: number, evPct: number) {
  return `
    <h2 style="color:#34d399">+EV bet: +${evPct.toFixed(2)}%</h2>
    <p><strong>${matchName}</strong></p>
    <p>${bookmaker}: ${outcome} @ ${offeredOdds.toFixed(2)}</p>
    <p><a href="https://edgeboard.com.au/ev">View EV bets →</a></p>
    <hr/>
    <p style="color:#888;font-size:12px">Gamble responsibly. <a href="https://www.gamblinghelponline.org.au">gamblinghelponline.org.au</a></p>
  `;
}

export function evAlertSms(matchName: string, bookmaker: string, outcome: string, evPct: number) {
  return `EdgeBoard EV: ${bookmaker} ${outcome} +${evPct.toFixed(2)}% EV (${matchName}). edgeboard.com.au/ev`;
}
