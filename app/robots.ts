import type { MetadataRoute } from "next";
import { config } from "@/src/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin"]
    },
    sitemap: `${config.siteUrl}/sitemap.xml`
  };
}
