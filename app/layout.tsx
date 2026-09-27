import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";
import { MainLayoutShell } from "./_components/MainLayoutShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Story",
  description: "Template-driven interactive story generation powered by AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <Analytics />
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <Providers>
          <MainLayoutShell>{children}</MainLayoutShell>
        </Providers>
      </body>
    </html>
  );
}
