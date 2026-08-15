import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "BakeSync",
    template: "%s | BakeSync",
  },
  description:
    "Autonomous AI-powered production planning and inventory management for commercial bakeries.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BakeSync",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "BakeSync",
    title: "BakeSync — Intelligent Bakery Operations",
    description:
      "Autonomous AI production planning and inventory management for commercial kitchens.",
  },
};

export const viewport: Viewport = {
  themeColor: "#D97706",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
