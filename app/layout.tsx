import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StarBlinks - Buy Pump.fun Tokens via Twitter",
  description:
    "One-click purchase of any Pump.fun token via Twitter Blinks. Earn 0.2% affiliate fees by sharing links.",
  openGraph: {
    title: "StarBlinks - Buy Pump.fun Tokens via Twitter",
    description:
      "One-click purchase of any Pump.fun token via Twitter Blinks. Earn 0.2% affiliate fees by sharing links.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StarBlinks - Buy Pump.fun Tokens via Twitter",
    description:
      "One-click purchase of any Pump.fun token via Twitter Blinks. Earn 0.2% affiliate fees by sharing links.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
