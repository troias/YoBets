"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import type { OddsRow } from "@/lib/types";

const columns: ColumnDef<OddsRow>[] = [
  { accessorKey: "eventName", header: "Event" },
  { accessorKey: "market", header: "Market" },
  { accessorKey: "selection", header: "Selection" },
  { accessorKey: "sportsbook", header: "Book" },
  { accessorKey: "odds", header: "Odds" },
  { accessorKey: "evPercent", header: "EV %" },
  { accessorKey: "valueScore", header: "Value" },
];

export function OddsTable({ data }: { data: OddsRow[] }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-950 text-zinc-400">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th className="px-3 py-2" key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr className="border-t border-zinc-800" key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td className="px-3 py-2" key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
