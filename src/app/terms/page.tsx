import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — EdgeBoard",
  description: "Terms of Service for EdgeBoard, an Australian NRL odds comparison and analytics platform.",
};

const EFFECTIVE_DATE = "30 June 2026";
const CONTACT_EMAIL = "troyflavel@gmail.com";
const SITE_URL = "https://yo-bets.vercel.app";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-zinc-300">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition">← EdgeBoard</Link>

      <h1 className="mt-8 text-3xl font-bold text-zinc-100">Terms of Service</h1>
      <p className="mt-2 text-sm text-zinc-500">Effective: {EFFECTIVE_DATE}</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed">

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">1. About EdgeBoard</h2>
          <p>EdgeBoard (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is an Australian odds comparison and analytics platform for NRL sports betting. EdgeBoard aggregates publicly available odds data and provides analytical tools including an arbitrage finder, expected value (EV) calculator, and line movement tracker.</p>
          <p className="mt-3">EdgeBoard is <strong className="text-zinc-100">not a bookmaker, betting exchange, or gambling service</strong>. We do not accept bets, hold funds, or facilitate gambling transactions. All betting activity occurs directly between you and licensed Australian bookmakers.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">2. Eligibility</h2>
          <p>By using EdgeBoard you confirm that you are:</p>
          <ul className="mt-2 ml-4 list-disc space-y-1 text-zinc-400">
            <li>At least 18 years of age</li>
            <li>Located in Australia or a jurisdiction where accessing odds comparison tools is legal</li>
            <li>Not prohibited from accessing gambling-related content under any applicable law</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">3. Subscription and Billing</h2>
          <p><strong className="text-zinc-100">Free tier:</strong> Full read access to all research tools at no cost. No payment information required.</p>
          <p className="mt-3"><strong className="text-zinc-100">Pro tier:</strong> $19 AUD per month or $99 AUD per year. Includes push, email, and SMS notifications, closing line value tracking, and ROI dashboard. A 7-day free trial is available on the first Pro subscription.</p>
          <p className="mt-3">Subscriptions are billed in advance through Stripe. By subscribing you authorise Stripe to charge your payment method on a recurring basis. You may cancel at any time from the Settings page; cancellation takes effect at the end of the current billing period and no partial refunds are issued.</p>
          <p className="mt-3">We reserve the right to change pricing with 30 days notice sent to your registered email address.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">4. Affiliate Disclosure</h2>
          <p>EdgeBoard participates in affiliate programs operated by Australian bookmakers. When you click a &quot;Bet →&quot; link and sign up or deposit at a bookmaker, we may receive a commission. This arrangement does not affect the odds displayed — all prices are fetched directly from each bookmaker&apos;s public feed.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">5. Accuracy of Information</h2>
          <p>Odds data is sourced from third-party APIs and scrapers and is provided for informational purposes only. Prices may be stale, incorrect, or no longer available by the time you act on them. <strong className="text-zinc-100">Always verify odds directly with the bookmaker before placing any bet.</strong> EdgeBoard accepts no liability for losses arising from reliance on displayed odds.</p>
          <p className="mt-3">Arbitrage and EV calculations are mathematical estimates based on available data. They do not guarantee profit. Bookmakers may void bets, restrict accounts, or withdraw prices without notice.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="mt-2 ml-4 list-disc space-y-1 text-zinc-400">
            <li>Scrape, copy, or redistribute EdgeBoard&apos;s odds data or analytical output</li>
            <li>Attempt to reverse-engineer, disrupt, or overload our systems</li>
            <li>Use EdgeBoard in violation of any applicable Australian law</li>
            <li>Share your account credentials with others</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">7. Responsible Gambling</h2>
          <p>Gambling carries financial risk. EdgeBoard&apos;s tools are designed to help you identify value, not to encourage gambling beyond your means. If gambling is affecting you or someone you know, contact <strong className="text-zinc-100">Gambling Help Online</strong> on <strong className="text-zinc-100">1800 858 858</strong> (free, 24/7) or visit <a href="https://www.gamblinghelponline.org.au" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">gamblinghelponline.org.au</a>.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">8. Intellectual Property</h2>
          <p>All content, code, design, and branding on EdgeBoard is owned by or licensed to us. You may not reproduce or distribute any part of the platform without our written permission.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">9. Limitation of Liability</h2>
          <p>To the maximum extent permitted by Australian law, EdgeBoard is provided &quot;as is&quot; without warranties of any kind. We are not liable for any direct, indirect, incidental, or consequential loss arising from your use of the platform, including but not limited to losses from betting decisions made in reliance on displayed odds or analytics.</p>
          <p className="mt-3">Nothing in these terms limits any rights you may have under the Australian Consumer Law.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">10. Termination</h2>
          <p>We may suspend or terminate your account if you breach these terms, abuse the platform, or engage in fraudulent activity. You may delete your account at any time by contacting us.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">11. Changes to These Terms</h2>
          <p>We may update these terms from time to time. Material changes will be notified via email. Continued use of EdgeBoard after changes are published constitutes acceptance.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">12. Governing Law</h2>
          <p>These terms are governed by the laws of New South Wales, Australia. Any disputes will be subject to the exclusive jurisdiction of the courts of New South Wales.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">13. Contact</h2>
          <p>Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-400 hover:underline">{CONTACT_EMAIL}</a></p>
          <p className="mt-1">Platform: <a href={SITE_URL} className="text-amber-400 hover:underline">{SITE_URL}</a></p>
        </section>
      </div>

      <div className="mt-12 border-t border-zinc-800 pt-6 flex gap-4 text-xs text-zinc-600">
        <Link href="/privacy" className="hover:text-zinc-400 transition">Privacy Policy</Link>
        <Link href="/" className="hover:text-zinc-400 transition">EdgeBoard Home</Link>
      </div>
    </div>
  );
}
