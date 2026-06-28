import type { MetadataRoute } from "next";

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

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
