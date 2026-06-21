import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

const BOOKMAKER_LABEL: Record<string, string> = {
  sportsbet: "Sportsbet", tab: "TAB", bet365: "Bet365", ladbrokes: "Ladbrokes",
  neds: "Neds", pointsbet: "PointsBet", unibet: "Unibet", betright: "BetRight",
  betr: "Betr", betfair: "Betfair", tabtouch: "TABtouch", playup: "PlayUp",
};

const FAQS = [
  {
    q: "Is this legal?",
    a: "Completely. EdgeBoard is an odds comparison tool — we show you publicly available prices across licensed Australian bookmakers. Shopping for the best odds is standard practice for any informed bettor.",
  },
  {
    q: "What is an arbitrage bet?",
    a: "An arb occurs when bookmakers price a market so differently that you can bet both sides and guarantee a profit regardless of the result. EdgeBoard finds these and calculates exact stakes for you.",
  },
  {
    q: "What does positive EV mean?",
    a: "Expected Value (EV) measures whether a bet is priced above its true probability. Our model removes the bookmaker margin from all available prices to find the fair line — then flags anything offered above it.",
  },
  {
    q: "Which bookmakers are covered?",
    a: "Sportsbet, TAB, Ladbrokes, Neds, PointsBet, Unibet, BetRight, Betr, Betfair, TABtouch, PlayUp, and Bet365. More bookmakers and markets being added.",
  },
  {
    q: "How often does the data update?",
    a: "Every 2 minutes. Arb windows can close in minutes — the update frequency is designed around that constraint.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the billing portal in your settings — no calls, no forms, instant effect.",
  },
];

export default async function HomePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();

  const [matchCount, oddsCount, previewMatch] = await Promise.all([
    prisma.match.count({ where: { kickoffAt: { gte: now } } }),
    prisma.odds.count(),
    prisma.match.findFirst({
      where: { kickoffAt: { gte: now } },
      include: {
        odds: {
          where: { marketType: "h2h" },
          orderBy: { bookmaker: "asc" },
          take: 16,
        },
      },
      orderBy: { kickoffAt: "asc" },
    }),
  ]);

  const previewBookmakers = previewMatch
    ? [...new Set(previewMatch.odds.map((o) => o.bookmaker))].slice(0, 6)
    : [];

  const bestHome = previewMatch
    ? Math.max(...previewMatch.odds.filter((o) => o.outcome === "home").map((o) => Number(o.price)))
    : 0;
  const bestAway = previewMatch
    ? Math.max(...previewMatch.odds.filter((o) => o.outcome === "away").map((o) => Number(o.price)))
    : 0;

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">EdgeBoard</span>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="text-sm text-zinc-400 hover:text-zinc-100 transition">
              Pricing
            </Link>
            {user ? (
              <Link
                href="/nrl"
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
              >
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-100 transition">
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  Start Free Trial
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-24 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-1.5 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Live NRL odds · Updated every 2 minutes
        </div>
        <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          Stop leaving money at
          <br />
          <span className="text-green-400">the wrong bookmaker.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
          EdgeBoard compares live NRL odds across 12 Australian bookmakers, surfaces arbitrage
          opportunities, and flags positive EV bets — so you always get the best price.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href={user ? "/nrl" : "/register"}
            className="rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-black transition hover:bg-zinc-200"
          >
            Start 7-Day Free Trial
          </Link>
          <Link
            href="/pricing"
            className="rounded-xl border border-zinc-700 px-8 py-3.5 text-base text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
          >
            See pricing →
          </Link>
        </div>
        <p className="mt-4 text-xs text-zinc-600">No credit card required during trial · Cancel anytime</p>
      </section>

      {/* Stats bar */}
      <div className="border-y border-zinc-800 bg-zinc-950/60">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 px-6 py-5">
          {[
            { value: "12", label: "Australian bookmakers" },
            { value: matchCount.toString(), label: "upcoming NRL matches" },
            { value: oddsCount.toLocaleString(), label: "odds tracked" },
            { value: "2 min", label: "refresh interval" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold text-zinc-100">{value}</div>
              <div className="text-xs text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live product preview */}
      {previewMatch && (
        <section className="mx-auto max-w-5xl px-6 py-20">
          <div className="mb-3 text-center">
            <span className="text-xs uppercase tracking-widest text-zinc-600">Live right now</span>
          </div>
          <h2 className="mb-8 text-center text-2xl font-semibold">
            This is what you see the moment you log in
          </h2>
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/90">
            <div className="border-b border-zinc-800 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {previewMatch.homeTeam}{" "}
                    <span className="text-zinc-500">vs</span>{" "}
                    {previewMatch.awayTeam}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {previewMatch.kickoffAt.toLocaleString("en-AU", {
                      timeZone: "Australia/Sydney",
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}{" "}
                    AEST
                  </div>
                </div>
                <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs text-green-400">
                  Best price highlighted
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-5 py-2.5 text-left text-xs font-normal text-zinc-500">Outcome</th>
                    {previewBookmakers.map((bm) => (
                      <th key={bm} className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500 whitespace-nowrap">
                        {BOOKMAKER_LABEL[bm] ?? bm}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(["home", "away"] as const).map((outcome) => {
                    const label = outcome === "home" ? previewMatch.homeTeam : previewMatch.awayTeam;
                    const best = outcome === "home" ? bestHome : bestAway;
                    const rows = previewMatch.odds.filter((o) => o.outcome === outcome);
                    return (
                      <tr key={outcome} className="border-b border-zinc-800/40 last:border-0">
                        <td className="px-5 py-3 text-xs text-zinc-400">
                          {label.split(" ").slice(-1)[0]}
                        </td>
                        {previewBookmakers.map((bm) => {
                          const odd = rows.find((o) => o.bookmaker === bm);
                          const price = odd ? Number(odd.price) : null;
                          const isBest = price !== null && price === best;
                          return (
                            <td key={bm} className="px-4 py-3 text-center">
                              {price !== null ? (
                                <span className={isBest ? "font-bold text-green-400" : "text-zinc-400"}>
                                  {price.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-zinc-700">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-600">
              Live data · Green = best available price · Click to open bookmaker
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="border-t border-zinc-800 bg-zinc-950/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="mb-12 text-center text-2xl font-semibold">Three tools. One dashboard.</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Odds Board",
                tag: "Always available",
                desc: "Live H2H, line, and total markets across 11 bookmakers. Best price highlighted. Click any price to bet directly.",
                detail: "You'll never wonder if you're at the best price again.",
              },
              {
                title: "Arb Finder",
                tag: "Guaranteed profit",
                desc: "Automatically detects when bookmakers disagree enough to bet both sides for a risk-free return.",
                detail: "Exact stake splits calculated. Arb windows close in minutes — we alert you first.",
              },
              {
                title: "EV Finder",
                tag: "Long-run edge",
                desc: "Our no-vig consensus model builds a fair probability from all bookmakers, then flags anything priced above it.",
                detail: "Positive EV bets lose sometimes. But they always win over time.",
              },
            ].map(({ title, tag, desc, detail }) => (
              <div
                key={title}
                className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950/90 p-6"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{title}</h3>
                  <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
                    {tag}
                  </span>
                </div>
                <p className="flex-1 text-sm text-zinc-400">{desc}</p>
                <p className="mt-4 border-t border-zinc-800 pt-4 text-xs text-zinc-600">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="mb-12 text-center text-2xl font-semibold">Up in 60 seconds</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { step: "1", title: "Create your account", desc: "Sign up with Google or email. No credit card needed to start your trial." },
            { step: "2", title: "Browse live odds", desc: "Every upcoming NRL match. Every bookmaker. Updated every 2 minutes." },
            { step: "3", title: "Bet at the best price", desc: "Click any highlighted price to go directly to the bookmaker. Done." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 text-sm font-semibold text-zinc-400">
                {step}
              </div>
              <h3 className="mb-2 font-medium">{title}</h3>
              <p className="text-sm text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-zinc-800 bg-zinc-950/40">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="mb-2 text-center text-2xl font-semibold">Simple pricing</h2>
          <p className="mb-12 text-center text-sm text-zinc-500">
            One plan. Everything included. 7-day free trial.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                period: "Monthly",
                price: "$12",
                unit: "AUD / month",
                note: "Billed monthly",
                annual: false,
              },
              {
                period: "Annual",
                price: "$99",
                unit: "AUD / year",
                note: "$8.25/month · Save 31%",
                annual: true,
              },
            ].map(({ period, price, unit, note, annual }) => (
              <div
                key={period}
                className={`relative rounded-2xl border p-6 ${
                  annual ? "border-zinc-600 bg-zinc-950/90" : "border-zinc-800 bg-zinc-950/90"
                }`}
              >
                {annual && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500/10 px-3 py-0.5 text-xs font-medium text-green-400">
                    Best value
                  </div>
                )}
                <div className="text-sm text-zinc-500">{period}</div>
                <div className="mt-2 flex items-end gap-1.5">
                  <span className="text-4xl font-bold">{price}</span>
                  <span className="mb-1 text-sm text-zinc-400">{unit}</span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-600">{note}</p>
                <div className="mt-6">
                  <Link
                    href={user ? "/pricing" : "/register"}
                    className="block w-full rounded-xl bg-white py-2.5 text-center text-sm font-semibold text-black transition hover:bg-zinc-200"
                  >
                    Start 7-Day Free Trial
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-zinc-600">
            All prices in AUD · GST included · Cancel anytime from your settings
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-2xl px-6 py-20">
        <h2 className="mb-10 text-center text-2xl font-semibold">Common questions</h2>
        <div className="space-y-0 divide-y divide-zinc-800 rounded-2xl border border-zinc-800 overflow-hidden">
          {FAQS.map(({ q, a }) => (
            <div key={q} className="bg-zinc-950/90 px-6 py-5">
              <p className="font-medium text-zinc-200">{q}</p>
              <p className="mt-1.5 text-sm text-zinc-500">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-zinc-800">
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold">
            Your next NRL bet should be at the best price.
          </h2>
          <p className="mt-3 text-zinc-400">
            Start your free trial. No credit card required.
          </p>
          <div className="mt-8">
            <Link
              href={user ? "/nrl" : "/register"}
              className="inline-block rounded-xl bg-white px-10 py-4 text-base font-semibold text-black transition hover:bg-zinc-200"
            >
              {user ? "Open Dashboard" : "Start 7-Day Free Trial"}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="font-semibold">EdgeBoard</div>
              <p className="mt-1 max-w-xs text-xs text-zinc-600">
                NRL odds comparison for Australian bettors. Not a bookmaker. Not affiliated with any bookmaker.
              </p>
            </div>
            <div className="flex gap-8 text-sm">
              <div className="space-y-2">
                <div className="text-xs font-medium text-zinc-500">Product</div>
                <div className="space-y-1.5">
                  <Link href="/pricing" className="block text-zinc-400 hover:text-zinc-100 transition">Pricing</Link>
                  <Link href="/login" className="block text-zinc-400 hover:text-zinc-100 transition">Sign in</Link>
                  <Link href="/register" className="block text-zinc-400 hover:text-zinc-100 transition">Register</Link>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-zinc-500">Legal</div>
                <div className="space-y-1.5">
                  <Link href="/terms" className="block text-zinc-400 hover:text-zinc-100 transition">Terms</Link>
                  <Link href="/privacy" className="block text-zinc-400 hover:text-zinc-100 transition">Privacy</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-zinc-800 pt-6 text-xs text-zinc-700">
            <p>
              Gambling can be addictive. For support visit{" "}
              <a
                href="https://www.gamblinghelponline.org.au"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-zinc-500"
              >
                Gambling Help Online
              </a>
              {" "}or call 1800 858 858. 18+ only. EdgeBoard does not provide gambling services.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
