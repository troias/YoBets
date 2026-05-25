import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4 text-zinc-100">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950/90 p-8 text-center">
        <h1 className="text-3xl font-semibold">EdgeBoard</h1>
        <p className="mt-3 text-zinc-400">
          Bloomberg-style Australian sports market intelligence for NRL, Bet365 edge discovery, EV analytics, and live line movement.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard"><Button>Open Dashboard</Button></Link>
          <Link href="/nrl"><Button variant="secondary">NRL Terminal</Button></Link>
        </div>
      </div>
    </div>
  );
}
