import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

const baseUrl = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account-restricted",
        "/community/new",
        "/communities",
        "/dashboard",
        "/events/new",
        "/groups/new",
        "/leader",
        "/messages",
        "/notifications",
        "/platform",
        "/prayer",
        "/profile",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
