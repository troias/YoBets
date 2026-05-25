import { Badge } from "@/components/ui/badge";

export function SteamMoveFeed({ moves }: { moves: { market: string; confidence: number; books: string[] }[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold">Steam Move Feed</h3>
      <div className="space-y-2">
        {moves.map((move) => (
          <div key={move.market} className="rounded-lg border border-zinc-800 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>{move.market}</span>
              <Badge variant="warning">{move.confidence}%</Badge>
            </div>
            <div className="mt-1 text-xs text-zinc-400">Lead books: {move.books.join(", ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
