import type { MetadataRoute } from "next";
import { getAdminRoutePath } from "@/src/lib/admin-route";
import { buildSitemapUrl } from "@/src/lib/sitemap";

export default function robots(): MetadataRoute.Robots {
  const adminRoutePath = getAdminRoutePath();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/editor", "/dashboard", "/backend", "/control", ...(adminRoutePath ? [adminRoutePath] : [])]
    },
    sitemap: buildSitemapUrl("/sitemap.xml")
  };
}
