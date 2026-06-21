import { cn } from "@/lib/utils/cn";

const MARKETS = [
  { value: "h2h", label: "H2H" },
  { value: "line", label: "Line" },
  { value: "total", label: "Total" },
] as const;

export type MarketType = (typeof MARKETS)[number]["value"];

export function MarketTabs({
  active,
  basePath,
  extra,
}: {
  active: MarketType;
  basePath: string;
  extra?: string;
}) {
  return (
    <div className="flex gap-1">
      {MARKETS.map(({ value, label }) => (
        <a
          key={value}
          href={`${basePath}?market=${value}${extra ? `&${extra}` : ""}`}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition",
            active === value
              ? "bg-zinc-700 text-zinc-100"
              : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
          )}
        >
          {label}
        </a>
      ))}
    </div>
  );
}
