import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
