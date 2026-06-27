import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://edgeboard.au";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/settings/", "/dashboard/", "/onboarding/"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
