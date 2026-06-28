import type { Metadata } from "next";
import "./globals.css";

const description = "An open faith community for encouragement, prayer, Bible study groups, and fellowship.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
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
  icons: {
    icon: "/images/selah-ember-logo.png",
  },
  openGraph: {
    title: "Selah Ember",
    description,
    siteName: "Selah Ember",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/images/selah-ember-logo.png",
        width: 1536,
        height: 864,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
