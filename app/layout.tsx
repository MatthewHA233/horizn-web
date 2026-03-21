import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HORIZN",
  description: "HORIZN 地平线",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
