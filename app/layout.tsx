import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "HORIZN",
  description: "HORIZN 地平线",
  icons: {
    icon: "/horizn.png",
    apple: "/horizn.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <head>
        <script defer src="https://umami.lingflow.cn/script.js" data-website-id="0bcf2e35-65ee-4baa-8a30-5d1c9faaba50"></script>
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
