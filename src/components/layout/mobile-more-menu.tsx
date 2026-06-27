"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NavItem = { href: string; label: string; icon: LucideIcon };

export function MobileMoreMenu({
  activePath,
  items,
}: {
  activePath: string;
  items: NavItem[];
}) {
  const [open, setOpen] = useState(false);
  const isActiveInMore = items.some(item => activePath.startsWith(item.href));

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex flex-1 flex-col items-center gap-1 py-3 text-[10px] transition",
          isActiveInMore ? "text-amber-300" : "text-zinc-500 hover:text-zinc-300",
        )}
        aria-label="More navigation"
      >
        <MoreHorizontal className={cn("h-5 w-5", isActiveInMore ? "text-zinc-100" : "")} />
        More
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-16 left-0 right-0 z-50 rounded-t-2xl border-t border-zinc-800 bg-zinc-950 px-4 pt-4 pb-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">More</span>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-600 hover:text-zinc-400 transition text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {items.map(({ href, label, icon: Icon }) => {
                const active = activePath.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl p-3 text-xs transition",
                      active
                        ? "bg-amber-500/10 text-amber-300"
                        : "bg-zinc-900 text-zinc-400 active:bg-zinc-800",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
