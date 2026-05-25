"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AlertModal() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Create Alert</Button>;
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
      <div className="mb-2 text-sm font-semibold">Create EV / Movement Alert</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="Market (e.g. NRL Head to Head)" />
        <Input placeholder="Threshold (e.g. EV > 3%)" />
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm">Save</Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </div>
  );
}
