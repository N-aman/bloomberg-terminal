import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Terminal — Real-time Order Book & Macro Dashboard",
  description:
    "A command-driven financial dashboard built on public APIs: live crypto order book (Binance WebSocket), macro data (FRED), and market news (Finnhub).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
