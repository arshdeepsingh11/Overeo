import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/shell/AppShell";

/* Brand fonts, self-hosted and preloaded by next/font (no layout shift). */
const hanken = localFont({
  src: [
    { path: "./fonts/hanken-grotesk-latin.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/hanken-grotesk-latin-ext.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-hanken",
  display: "swap",
});
const serif = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-italic-latin.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
});
const mono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  weight: "100 800",
  variable: "--font-jetbrains",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "OVEREO — Your body. Your biology. Your future.", template: "%s · OVEREO" },
  description: "OVEREO is a women's precision-health platform. Meet Overeo SI — press O anywhere.",
  applicationName: "OVEREO",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "OVEREO", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // light by default, even when the phone itself is in dark mode
  themeColor: "#FBF6F3",
};

// Runs before first paint. OVEREO is light by default (the calm Rose Quartz
// look); dark only when the visitor chooses it. Setting the theme here keeps
// text and background in sync from the very first frame.
const themeScript = `try{var t=localStorage.getItem("overeo.theme.v2");if(t==="auto")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";if(t!=="dark")t="light";document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="light";}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${hanken.variable} ${serif.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
