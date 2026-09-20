export const runtime = "edge";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import "./player.css";
import "./youtube.css";
import { YouTubeShell } from "@/components/YouTubeShell";
import { Corners } from "@/components/Corners";
import { siteOrigin } from "@/lib/site";
import { RouteProgress } from "@/components/RouteProgress";
import { MobileDock } from "@/components/MobileDock";
import { AuthSessionSync } from "@/components/AuthSessionSync";
import { TVNavigationManager } from "@/components/TVNavigationManager";
import { PwaRuntime } from "@/components/PwaRuntime";

// Required by @cloudflare/next-on-pages — all routes must target the
// Cloudflare Edge Runtime (V8 isolates). Declaring it here propagates to
// every page and layout nested under this root layout.
const description =
  "Every anime you're chasing, in one place. Sub and dub, simulcast within the hour of Japanese broadcast.";
// ANIGHOST_API_ORIGIN is the origin the *backend* allowlists, not this site's
// own address. Falling back to it made metadataBase resolve to the API host,
// so every relative canonical and social URL pointed at the wrong domain.
const metadataBase = trustedOrigin(siteOrigin());

export const metadata: Metadata = {
  metadataBase,
  // Every page declares the canonical host, so previews and the vercel.app
  // alias never compete with anighost.com in an index.
  alternates: { canonical: "/" },
  title: { default: "Ani Ghost", template: "%s — Ani Ghost" },
  description,
  applicationName: "Ani Ghost",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Ani Ghost", statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    siteName: "Ani Ghost",
    title: "Ani Ghost",
    description,
  },
  twitter: {
    card: "summary",
    title: "Ani Ghost",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#161522" },
    { media: "(prefers-color-scheme: light)", color: "#f6f5fb" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applied before paint so a saved choice never flashes the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement;var t=localStorage.getItem('anighost-theme');if(t)d.setAttribute('data-theme',t);var p=JSON.parse(localStorage.getItem('anighost-prefs')||'{}');if(p&&p.reduceMotion)d.setAttribute('data-reduce-motion','')}catch(e){}`,
          }}
        />
        <meta name="referrer" content="no-referrer" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap"
        />
       <script defer src="https://cloud.umami.is/script.js" data-website-id="21fb4b57-2b65-43fe-b5d1-c5e3c956381f"></script>
      </head>
      <body>
        <Suspense fallback={null}>
          <AuthSessionSync />
        </Suspense>
        <TVNavigationManager />
        <PwaRuntime />
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <Suspense fallback={<div style={{ height: "var(--yt-header-height)" }} />}>
          <YouTubeShell>
            {children}
          </YouTubeShell>
        </Suspense>
        <Suspense fallback={null}>
          <MobileDock />
        </Suspense>
        <Suspense fallback={null}>
          <Corners />
        </Suspense>
      </body>
    </html>
  );
}

function trustedOrigin(value: string | undefined): URL | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? new URL(url.origin)
      : undefined;
  } catch {
    return undefined;
  }
}
