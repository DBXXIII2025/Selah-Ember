const PRODUCTION_SITE_URL = "https://selahember.com";
const LOCAL_SITE_URL = "http://localhost:3000";

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === "production"
      ? PRODUCTION_SITE_URL
      : process.env.NEXT_PUBLIC_APP_URL || LOCAL_SITE_URL);

  return configuredUrl.replace(/\/$/, "");
}

export function getCanonicalUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}
