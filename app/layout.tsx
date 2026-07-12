import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { SiteFooter } from "@/components/ui/site-footer";
import { getCanonicalUrl, getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const description = "An open faith community for encouragement, prayer, Bible study groups, and fellowship.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: "Selah Ember",
  title: {
    default: "Selah Ember",
    template: "%s | Selah Ember",
  },
  description,
  keywords: [
    "Selah Ember",
    "open faith community",
    "digital fellowship",
    "prayer requests",
    "Bible study groups",
    "faith events",
  ],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/images/selah-ember-logo.png",
    apple: "/icons/selah-ember-icon-192.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Selah Ember",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Selah Ember",
    description,
    siteName: "Selah Ember",
    url: getCanonicalUrl("/"),
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/images/selah-ember-logo.png",
        width: 1536,
        height: 1536,
        alt: "Selah Ember logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Selah Ember",
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#151210",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <div className="flex min-h-screen flex-col bg-[#f7ead7] text-[#211814]">
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
