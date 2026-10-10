// Scaffold layout. P2 owns navigation and the simulated-data footer (X5) and may replace this file.
import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });

export const metadata: Metadata = { title: "RoadWatch", description: "Public works transparency and coordination for Chennai" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body className={`${plex.variable} font-sans`}>
        <AuthProvider>{children}</AuthProvider>
        <footer className="px-4 py-6 text-center text-xs text-ink/60">All data shown is simulated for a hackathon demo.</footer>
      </body>
    </html>
  );
}
