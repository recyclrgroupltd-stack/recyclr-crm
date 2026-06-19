import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecyclrCore Staff Portal",
  description: "Recyclr brokerage staff portal",
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