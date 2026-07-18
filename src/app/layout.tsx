import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleMapsKeyProvider } from "@/components/maps/google-maps-key-context";
import { getBrowserGoogleMapsApiKey } from "@/lib/maps/google-maps-key";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maps Rank Tracker",
  description: "Google Maps visibility audits and weekly action plans",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const mapsApiKey = getBrowserGoogleMapsApiKey() ?? null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GoogleMapsKeyProvider apiKey={mapsApiKey}>{children}</GoogleMapsKeyProvider>
      </body>
    </html>
  );
}
