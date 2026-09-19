import type { Metadata } from "next";

/**
 * The settings page is a client component, so it cannot export metadata of
 * its own — which is why its tab read plain "Ani Ghost" while every other
 * page named itself. A layout can, so the title lives here.
 */
export const metadata: Metadata = {
  title: "Profile",
  description: "Character, playback and appearance preferences, stored on this device.",
  robots: { index: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
