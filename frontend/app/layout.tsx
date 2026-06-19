import type { Metadata } from "next";
import { BackendFetchBridge } from "@/components/BackendFetchBridge";
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
      <body>
        <BackendFetchBridge />
        {children}
      </body>
    </html>
  );
}
