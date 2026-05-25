import { create } from "zustand";
import type { OddsRow } from "@/lib/types";

type DashboardState = {
  selectedSport: string;
  rows: OddsRow[];
  setSelectedSport: (sport: string) => void;
  setRows: (rows: OddsRow[]) => void;
};

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedSport: "NRL",
  rows: [],
  setSelectedSport: (selectedSport) => set({ selectedSport }),
  setRows: (rows) => set({ rows }),
}));
