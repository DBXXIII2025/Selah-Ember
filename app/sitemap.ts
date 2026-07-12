import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

const baseUrl = getSiteUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/community", "/discover", "/discover/groups"];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "daily",
    priority: route === "" ? 1 : 0.8,
  }));
}
