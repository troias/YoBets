import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — EdgeBoard",
  description: "Privacy Policy for EdgeBoard, compliant with the Australian Privacy Act 1988.",
};

const EFFECTIVE_DATE = "30 June 2026";
const CONTACT_EMAIL = "troyflavel@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-zinc-300">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition">← EdgeBoard</Link>

      <h1 className="mt-8 text-3xl font-bold text-zinc-100">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">Effective: {EFFECTIVE_DATE}</p>
      <p className="mt-2 text-xs text-zinc-600">Compliant with the Australian Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed">

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">1. Who We Are</h2>
          <p>EdgeBoard (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is an Australian odds comparison and analytics platform for NRL sports betting. We are committed to protecting your personal information in accordance with the Australian Privacy Act 1988 (Cth).</p>
          <p className="mt-3">Contact: <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-400 hover:underline">{CONTACT_EMAIL}</a></p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">2. What Information We Collect</h2>

          <p className="font-medium text-zinc-200 mt-4 mb-2">Information you provide directly:</p>
          <ul className="ml-4 list-disc space-y-1 text-zinc-400">
            <li>Email address (required to create an account)</li>
            <li>Name (if you sign in with Google or Facebook)</li>
            <li>Phone number (optional — only if you opt into SMS notifications)</li>
            <li>Bet log entries you choose to record (match, odds, stake, result)</li>
            <li>Bookmaker balances you enter in the balance tracker</li>
            <li>Notification preferences</li>
          </ul>

          <p className="font-medium text-zinc-200 mt-4 mb-2">Payment information:</p>
          <p className="text-zinc-400">Pro subscriptions are processed by <strong className="text-zinc-300">Stripe</strong>. We never store your card number, expiry, or CVV. Stripe stores payment details under their own privacy policy and PCI-DSS compliance. We receive and store only your Stripe Customer ID and subscription status.</p>

          <p className="font-medium text-zinc-200 mt-4 mb-2">Information collected automatically:</p>
          <ul className="ml-4 list-disc space-y-1 text-zinc-400">
            <li>Browser push notification subscription tokens (if you opt in)</li>
            <li>Cookies used for session management and preferences (favourite team, bookmaker balances)</li>
            <li>Referral codes passed in URLs</li>
            <li>Aggregate analytics (page views, feature usage) via Posthog — anonymised where possible</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">3. How We Use Your Information</h2>
          <ul className="ml-4 list-disc space-y-1 text-zinc-400">
            <li>To provide and operate the EdgeBoard platform</li>
            <li>To send notifications you have subscribed to (arb alerts, price alerts, EV alerts, digest emails)</li>
            <li>To process and manage your Pro subscription via Stripe</li>
            <li>To calculate and display your bet P&L, ROI, and closing line value</li>
            <li>To send transactional emails (trial reminders, payment receipts, weekly performance summaries)</li>
            <li>To improve the platform based on anonymised usage analytics</li>
            <li>To contact you about material changes to these policies</li>
          </ul>
          <p className="mt-3">We do not use your information for automated decision-making that produces legal or similarly significant effects.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">4. Affiliate Links</h2>
          <p>When you click a bookmaker link from EdgeBoard, we track the click for affiliate commission purposes. We may receive a commission if you sign up or deposit at a bookmaker. We do not share your personal information with bookmakers — the click tracking is anonymous.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">5. Third-Party Services</h2>
          <p>We use the following third-party services to operate EdgeBoard:</p>
          <div className="mt-3 space-y-3">
            {[
              { name: "Supabase", purpose: "Authentication and database (PostgreSQL). User data stored in AWS ap-southeast-2 (Sydney).", link: "https://supabase.com/privacy" },
              { name: "Stripe", purpose: "Payment processing and subscription management.", link: "https://stripe.com/au/privacy" },
              { name: "Resend", purpose: "Transactional email delivery.", link: "https://resend.com/legal/privacy-policy" },
              { name: "Twilio", purpose: "SMS notifications (only if you provide a phone number).", link: "https://www.twilio.com/en-us/legal/privacy" },
              { name: "Posthog", purpose: "Product analytics — anonymised usage data.", link: "https://posthog.com/privacy" },
              { name: "Vercel", purpose: "Web hosting and edge functions.", link: "https://vercel.com/legal/privacy-policy" },
              { name: "Google / Meta", purpose: "OAuth sign-in only — we receive your email and name. We do not share any other data with them.", link: null },
            ].map(({ name, purpose, link }) => (
              <div key={name} className="rounded-lg bg-zinc-900/50 border border-zinc-800 p-3">
                <p className="font-medium text-zinc-200">{name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{purpose}</p>
                {link && <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:underline">Privacy policy →</a>}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">6. Data Storage and Security</h2>
          <p>Your data is stored in Supabase PostgreSQL hosted in AWS ap-southeast-2 (Sydney, Australia). We use industry-standard encryption in transit (TLS) and at rest. Access to production data is restricted to the platform operator.</p>
          <p className="mt-3">We do not sell, rent, or trade your personal information to third parties.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">7. Cookies</h2>
          <p>We use cookies for:</p>
          <ul className="ml-4 list-disc space-y-1 text-zinc-400 mt-2">
            <li><strong className="text-zinc-300">Session management</strong> — Supabase authentication tokens (essential)</li>
            <li><strong className="text-zinc-300">Preferences</strong> — your favourite NRL team and bookmaker balances (stored locally, never sent to our servers)</li>
            <li><strong className="text-zinc-300">Referral tracking</strong> — a temporary cookie to attribute your registration to a referrer</li>
          </ul>
          <p className="mt-3">We do not use third-party advertising cookies.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">8. Your Rights Under the Australian Privacy Act</h2>
          <p>Under the Australian Privacy Principles you have the right to:</p>
          <ul className="ml-4 list-disc space-y-1 text-zinc-400 mt-2">
            <li><strong className="text-zinc-300">Access</strong> the personal information we hold about you</li>
            <li><strong className="text-zinc-300">Correct</strong> inaccurate personal information</li>
            <li><strong className="text-zinc-300">Delete</strong> your account and associated personal data</li>
            <li><strong className="text-zinc-300">Opt out</strong> of marketing emails using the unsubscribe link in any email</li>
            <li><strong className="text-zinc-300">Withdraw consent</strong> for push or SMS notifications at any time from Settings</li>
          </ul>
          <p className="mt-3">To exercise these rights, email <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-400 hover:underline">{CONTACT_EMAIL}</a>. We will respond within 30 days.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">9. Retention</h2>
          <p>We retain your account data for as long as your account is active. If you delete your account, we will remove your personal information within 30 days, except where we are required to retain it for legal or financial compliance purposes (e.g. Stripe billing records).</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">10. Children</h2>
          <p>EdgeBoard is not directed at persons under 18 years of age. We do not knowingly collect personal information from anyone under 18. If you believe a minor has provided us with personal information, please contact us and we will delete it.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">11. Changes to This Policy</h2>
          <p>We may update this policy from time to time. Material changes will be notified via email to registered users. The effective date at the top of this page will always reflect the current version.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">12. Complaints</h2>
          <p>If you have a complaint about how we handle your personal information, please contact us first at <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-400 hover:underline">{CONTACT_EMAIL}</a>. If we cannot resolve your complaint, you may contact the <strong className="text-zinc-100">Office of the Australian Information Commissioner (OAIC)</strong> at <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">oaic.gov.au</a> or 1300 363 992.</p>
        </section>

      </div>

      <div className="mt-12 border-t border-zinc-800 pt-6 flex gap-4 text-xs text-zinc-600">
        <Link href="/terms" className="hover:text-zinc-400 transition">Terms of Service</Link>
        <Link href="/" className="hover:text-zinc-400 transition">EdgeBoard Home</Link>
      </div>
    </div>
  );
}
