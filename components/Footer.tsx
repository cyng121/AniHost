import Link from "next/link";
import { Ghost } from "./Ghost";
import { Wordmark } from "./Wordmark";

/**
 * The floating Discord button is hidden below the mobile breakpoint, where the
 * dock owns the bottom of the screen. The footer carries the same link so the
 * community is still one tap away on a phone.
 */
const DISCORD_URL = process.env.NEXT_PUBLIC_ANIGHOST_DISCORD_URL?.trim() || "https://discord.gg/CW9kFv2SPT";

function discordHref(): string {
  if (!DISCORD_URL) return "https://discord.gg/CW9kFv2SPT";
  try {
    const url = new URL(DISCORD_URL);
    return url.protocol === "https:" ? url.toString() : "https://discord.gg/CW9kFv2SPT";
  } catch {
    return "https://discord.gg/CW9kFv2SPT";
  }
}

export function Footer() {
  const discord = discordHref();

  return (
    <footer className="foot">
      <div className="foot__row">
        <Ghost className="foot__mark" />
        <Wordmark className="foot__wordmark" />
        <Link href="/">Home</Link>
        <Link href="/?sort=top-rated">Top Rated</Link>
        <Link href="/saves">Saved</Link>
        <Link href="/copyright">Copyright</Link>
        <a href={discord} target="_blank" rel="noreferrer noopener">
          Discord
        </a>
        <span className="foot__spacer" />
        <small className="foot__legal">&copy; {new Date().getFullYear()} Ani Ghost</small>
      </div>
    </footer>
  );
}
