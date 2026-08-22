import type { Metadata, Viewport } from "next";

import { siteContent } from "@/content/site";

import "./globals.css";

export const metadata: Metadata = {
  title: siteContent.metadata.title,
  description: siteContent.metadata.description,
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
