import type { MetadataRoute } from "next";
import { getSiteUrl, isPublicIndexingDisabled } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  if (isPublicIndexingDisabled()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/"
      }
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/admin/", "/draw/", "/players/"]
    },
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
