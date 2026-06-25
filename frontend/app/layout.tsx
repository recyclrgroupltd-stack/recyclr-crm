import type { Metadata } from "next";
import { BackendFetchBridge } from "@/components/BackendFetchBridge";
import { PenTextFieldFocus } from "@/components/PenTextFieldFocus";
import { TheBinfluencerWidget } from "@/components/TheBinfluencerWidget";
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
        <PenTextFieldFocus />
        {children}
        <TheBinfluencerWidget />
      </body>
    </html>
  );
}
