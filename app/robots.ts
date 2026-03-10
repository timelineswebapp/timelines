import type { MetadataRoute } from "next";
import { config } from "@/src/lib/config";
import { getAdminRoutePath } from "@/src/lib/admin-route";

export default function robots(): MetadataRoute.Robots {
  const adminRoutePath = getAdminRoutePath();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/editor", "/dashboard", ...(adminRoutePath ? [adminRoutePath] : [])]
    },
    sitemap: `${config.siteUrl}/sitemap.xml`
  };
}
