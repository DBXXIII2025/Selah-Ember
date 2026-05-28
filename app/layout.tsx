import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Selah Ember",
  description: "A digital fellowship platform for churches, groups, and believers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
