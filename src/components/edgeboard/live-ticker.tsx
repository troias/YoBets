export function LiveTicker({ items }: { items: string[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
      <div className="flex gap-6 whitespace-nowrap animate-pulse">{items.map((item) => <span key={item}>{item}</span>)}</div>
    </div>
  );
}
