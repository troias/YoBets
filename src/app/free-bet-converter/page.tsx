import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { FreeBetCalculator } from "./calculator";

export default async function FreeBetConverterPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AppShell activePath="/free-bet-converter" userEmail={user?.email}>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Free Bet Converter</h1>
          <p className="text-sm text-zinc-400">
            Lock in guaranteed cash from bookmaker free bets and bonuses
          </p>
        </div>
        <FreeBetCalculator />
      </div>
    </AppShell>
  );
}
