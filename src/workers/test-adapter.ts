// Smoke test: fetch NRL odds from all sources and log normalised output.
// Run: npx tsx --env-file .env.local src/workers/test-adapter.ts

import { TheOddsApiAdapter } from "./scrapers/adapters/the-odds-api";
import { Bet365Adapter } from "./scrapers/adapters/bet365";

async function main() {
  const results = await Promise.allSettled([
    runAdapter("The Odds API", new TheOddsApiAdapter()),
    runAdapter("Bet365 (Playwright)", new Bet365Adapter()),
  ]);

  let totalRows = 0;
  const allBookmakers = new Set<string>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      totalRows += result.value.rowCount;
      result.value.bookmakers.forEach((b) => allBookmakers.add(b));
    }
  }

  console.log("\n─────────────────────────────────");
  console.log(`Total odds rows: ${totalRows}`);
  console.log(`Bookmakers with data: ${[...allBookmakers].sort().join(", ")}`);
}

async function runAdapter(
  name: string,
  adapter: { fetch(): Promise<any[]> },
): Promise<{ rowCount: number; bookmakers: string[] }> {
  console.log(`\n[${name}] Fetching...`);
  try {
    const rows = await adapter.fetch();

    const byMatch = new Map<string, Map<string, typeof rows>>();
    for (const row of rows) {
      const matchKey = `${row.homeTeam} vs ${row.awayTeam}`;
      if (!byMatch.has(matchKey)) byMatch.set(matchKey, new Map());
      const byBk = byMatch.get(matchKey)!;
      if (!byBk.has(row.bookmaker)) byBk.set(row.bookmaker, []);
      byBk.get(row.bookmaker)!.push(row);
    }

    for (const [match, byBk] of byMatch) {
      const kickoff = [...byBk.values()][0][0].kickoffAt.toLocaleString("en-AU", {
        timeZone: "Australia/Sydney",
        dateStyle: "short",
        timeStyle: "short",
      });
      console.log(`\n  ${match} (${kickoff})`);
      for (const [bk, bkRows] of byBk) {
        const h2h = bkRows.filter((r) => r.marketType === "h2h");
        const line = bkRows.filter((r) => r.marketType === "line");
        const total = bkRows.filter((r) => r.marketType === "total");
        const parts = [
          h2h.length ? `h2h:${h2h.map((r) => r.price.toFixed(2)).join("/")}` : null,
          line.length ? `line:${line.map((r) => `${r.price.toFixed(2)}(${r.lineValue > 0 ? "+" : ""}${r.lineValue})`).join("/")}` : null,
          total.length ? `total:${total.map((r) => r.price.toFixed(2)).join("/")}` : null,
        ].filter(Boolean);
        console.log(`    ${bk.padEnd(12)} ${parts.join("  ")}`);
      }
    }

    const bookmakers = [...new Set(rows.map((r) => r.bookmaker))];
    console.log(`\n  [${name}] ✓ ${rows.length} rows, ${byMatch.size} matches, ${bookmakers.length} bookmakers: ${bookmakers.sort().join(", ")}`);
    return { rowCount: rows.length, bookmakers };
  } catch (err) {
    console.error(`  [${name}] ✗ Failed:`, String(err).split("\n")[0]);
    return { rowCount: 0, bookmakers: [] };
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
