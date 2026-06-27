import type { MetadataRoute } from "next";

const TEAMS = [
  "broncos", "raiders", "bulldogs", "dolphins", "titans", "sea-eagles",
  "storm", "knights", "cowboys", "eels", "panthers", "rabbitohs",
  "dragons", "roosters", "tigers", "warriors", "sharks",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://edgeboard.au";
  const now  = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/nrl`,          lastModified: now, changeFrequency: "hourly", priority: 1.0 },
    { url: `${base}/pricing`,      lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`,        lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const teamRoutes: MetadataRoute.Sitemap = TEAMS.map(team => ({
    url: `${base}/nrl/${team}`,
    lastModified: now,
    changeFrequency: "hourly" as const,
    priority: 0.9,
  }));

  return [...staticRoutes, ...teamRoutes];
}
