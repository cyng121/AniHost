"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The two floating controls: shuffle bottom-left, support bottom-right.
 *
 * They sit outside the page flow deliberately — always reachable, never part
 * of what you are reading. Both hide themselves on the watch screen, where
 * nothing is allowed to compete with the episode.
 */

const SUPPORT_URL = process.env.NEXT_PUBLIC_ANIGHOST_SUPPORT_URL?.trim() ?? "";
const DISCORD_URL = process.env.NEXT_PUBLIC_ANIGHOST_DISCORD_URL?.trim() || "https://discord.gg/CW9kFv2SPT";

/** Only an https link is worth rendering; anything else is a dead button. */
function safeExternal(raw: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function Corners() {
  const pathname = usePathname();
  // The watch screen is the one place nothing may compete with the episode.
  if (pathname?.startsWith("/watch/")) return null;

  return (
    <>
      <a className="corner corner--left" href="/api/random" aria-label="Surprise me — open a random title">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 4h4v4M21 4l-6.5 6.5M17 20h4v-4M21 20l-6.5-6.5M3 4l4.2 4.2M3 20l7-7" />
        </svg>
      </a>
      <Community />
      <Sponsor />
    </>
  );
}

/**
 * The community link, stacked directly above Support.
 *
 * Both are ways of reaching past the catalogue, so they belong together; the
 * left corner stays with shuffle, which acts on the site itself. With no
 * invite configured the button is absent rather than dead — the same rule the
 * Apps page follows for platforms without a release.
 */
function Community() {
  const href = safeExternal(DISCORD_URL);
  if (!href) return null;

  return (
    <a
      className="corner corner--right corner--above"
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Join the Ani Ghost community on Discord"
      title="Join the community on Discord"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.198.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
      </svg>
    </a>
  );
}

/**
 * Support.
 *
 * A panel in the corner, not a page and not a takeover: it opens over the
 * bottom-right and everything behind it stays where it was.
 *
 * Card details are never typed here. Each method hands off to that provider's
 * own checkout, which is where the number and CVV belong — this project has no
 * business holding either, and a form that collected them would put the site
 * in PCI scope for no gain. Methods without a configured destination are left
 * out rather than shown as buttons that go nowhere.
 */

type MethodId = "card" | "paypal" | "google" | "apple";

interface Method {
  id: MethodId;
  label: string;
  /** The URL this method opens, if one is configured. */
  url: string;
  icon: React.ReactNode;
}

const CARD_ICON = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M2 10h20" strokeLinecap="round" />
  </svg>
);

const PAYPAL_ICON = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81.85.965 1.184 2.24.99 3.91-.024.203-.052.41-.084.62-.68 4.42-3.61 5.95-7.35 5.95H10.8c-.524 0-.968.382-1.05.9l-.98 6.22-.27 1.71a.641.641 0 0 1-.633.54zm7.25-15.16c-.06.39-.36.68-.75.68h-1.6l.53-3.36h1.24c1.04 0 1.79.24 2.09.72.14.22.19.5.14.85-.02.13-.04.26-.06.39z" />
  </svg>
);

const GOOGLE_ICON = (
  <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden>
    <path d="M5.443 10.667c1.344-.016 2.646.479 3.641 1.391l-1.552 1.521a3.29 3.29 0 0 0-2.089-.797c-1.385.005-2.609.891-3.057 2.198a3.42 3.42 0 0 0 0 2.042c.448 1.307 1.672 2.193 3.057 2.198.734 0 1.365-.182 1.854-.505.568-.375.964-.958 1.083-1.625h-2.938v-2.052h5.13c.63.359.94.719.094 1.083 0 1.625-.594 3-1.62 3.927-.901.813-2.135 1.286-3.604 1.286-2.047.01-3.922-1.125-4.865-2.938-.771-1.505-.771-3.286 0-4.792.943-1.813 2.818-2.948 4.859-2.938zM32 13.333l-4.177 9.333h-1.292l1.552-3.266-2.75-6.068h1.359l1.99 4.651h.026l1.927-4.651z" />
  </svg>
);

const APPLE_ICON = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
    <path d="M17.05 12.536c-.026-2.56 2.09-3.79 2.185-3.85-1.19-1.74-3.043-1.98-3.7-2.006-1.575-.16-3.073.928-3.87.928-.8 0-2.026-.905-3.33-.88-1.713.026-3.29.996-4.17 2.53-1.777 3.08-.454 7.64 1.276 10.14.845 1.22 1.852 2.59 3.176 2.54 1.275-.052 1.757-.825 3.3-.825 1.54 0 1.976.825 3.325.8 1.372-.026 2.24-1.243 3.078-2.47.968-1.417 1.367-2.79 1.39-2.86-.03-.013-2.667-1.023-2.693-4.05zM14.53 4.6c.7-.85 1.174-2.03 1.044-3.207-1.01.04-2.232.672-2.956 1.52-.65.75-1.22 1.952-1.067 3.104 1.128.087 2.28-.573 2.98-1.417z" />
  </svg>
);

/** Every method, with whatever destination it has been given. */
function methods(): Method[] {
  const generic = process.env.NEXT_PUBLIC_ANIGHOST_SUPPORT_URL?.trim() ?? "";
  const all: Method[] = [
    { id: "card", label: "Card", url: generic, icon: CARD_ICON },
    {
      id: "paypal",
      label: "PayPal",
      url: process.env.NEXT_PUBLIC_ANIGHOST_SUPPORT_PAYPAL_URL?.trim() ?? "",
      icon: PAYPAL_ICON,
    },
    {
      id: "google",
      label: "Google Pay",
      url: process.env.NEXT_PUBLIC_ANIGHOST_SUPPORT_GOOGLE_URL?.trim() ?? "",
      icon: GOOGLE_ICON,
    },
    {
      id: "apple",
      label: "Apple Pay",
      url: process.env.NEXT_PUBLIC_ANIGHOST_SUPPORT_APPLE_URL?.trim() ?? "",
      icon: APPLE_ICON,
    },
  ];
  return all.filter((m) => m.url);
}

const MONTHLY_URL = process.env.NEXT_PUBLIC_ANIGHOST_SUPPORT_MONTHLY_URL?.trim() ?? "";
const PRESETS = [3, 5, 10];

function Sponsor() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("5");
  const [monthly, setMonthly] = useState(false);
  const available = methods();
  const [method, setMethod] = useState<MethodId | null>(available[0]?.id ?? null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and a click anywhere outside closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const value = Number(amount);
  const valid = Number.isFinite(value) && value >= 0.01;
  const chosen = available.find((m) => m.id === method) ?? null;
  // Monthly only appears when there is somewhere for it to go, so the choice
  // is never offered and then quietly ignored.
  const base = monthly && MONTHLY_URL ? MONTHLY_URL : chosen?.url ?? "";
  const href = valid ? checkoutHref(base, value) : null;

  return (
    <div className="sponsor">
      <button
        ref={triggerRef}
        className="corner corner--right sponsor__trigger"
        aria-label="Support the project"
        aria-expanded={open}
        aria-controls="sponsorPanel"
        onClick={() => setOpen((v) => !v)}
      >
        Support
      </button>

      {open ? (
        <div className="sponsor__panel" id="sponsorPanel" role="dialog" aria-labelledby="sponsorTitle" ref={panelRef}>
          <div className="sponsor__head">
            <h3 id="sponsorTitle">Support</h3>
            <button
              className="sponsor__x"
              onClick={() => {
                setOpen(false);
                window.requestAnimationFrame(() => triggerRef.current?.focus());
              }}
              aria-label="Close"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {available.length === 0 ? (
            <p className="sponsor__note">
              Support is not connected yet. The rest of Ani Ghost is unaffected.
            </p>
          ) : (
            <>
              <div className="sponsor__presets" role="group" aria-label="Amount">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={amount === String(preset) ? "sponsor__preset is-on" : "sponsor__preset"}
                    aria-pressed={amount === String(preset)}
                    onClick={() => setAmount(String(preset))}
                  >
                    ${preset}
                  </button>
                ))}
              </div>

              <label className="sponsor__amount">
                <span aria-hidden>$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  aria-label="Support amount in US dollars"
                />
              </label>

              {MONTHLY_URL ? (
                <div className="sponsor__cycle" role="group" aria-label="How often">
                  <button
                    type="button"
                    className={monthly ? "sponsor__cycleBtn" : "sponsor__cycleBtn is-on"}
                    aria-pressed={!monthly}
                    onClick={() => setMonthly(false)}
                  >
                    Once
                  </button>
                  <button
                    type="button"
                    className={monthly ? "sponsor__cycleBtn is-on" : "sponsor__cycleBtn"}
                    aria-pressed={monthly}
                    onClick={() => setMonthly(true)}
                  >
                    Monthly
                  </button>
                </div>
              ) : null}

              {available.length > 1 ? (
                <fieldset className="sponsor__methods">
                  <legend className="sponsor__legend">Payment method</legend>
                  {available.map((m) => (
                    <label key={m.id} className="sponsor__method">
                      <span className="sponsor__methodIcon" aria-hidden>
                        {m.icon}
                      </span>
                      <span className="sponsor__methodLabel">{m.label}</span>
                      <input
                        type="radio"
                        name="sponsorMethod"
                        value={m.id}
                        checked={method === m.id}
                        onChange={() => setMethod(m.id)}
                      />
                    </label>
                  ))}
                </fieldset>
              ) : null}

              {href ? (
                <a className="sponsor__go" href={href} target="_blank" rel="noreferrer noopener">
                  Continue{monthly ? " monthly" : ""}
                </a>
              ) : (
                <button className="sponsor__go" type="button" disabled>
                  Continue
                </button>
              )}

              <p className="sponsor__note">
                Card details are entered on the payment provider&rsquo;s own page. Ani Ghost never
                sees or stores them.
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Put the chosen amount into the provider's link.
 *
 * `{amount}` is substituted where the provider wants it in the path; without a
 * placeholder the amount goes on as a query parameter, which is what most
 * hosted checkouts accept. Anything that is not https is refused rather than
 * rendered as a link that leaks the click somewhere unexpected.
 */
function checkoutHref(base: string, amount: number): string | null {
  if (!base) return null;
  const value = amount.toFixed(2).replace(/\.00$/, "");

  try {
    const hasTemplate = base.includes("{amount}");
    const url = new URL(
      hasTemplate ? base.replace(/\{amount\}/g, encodeURIComponent(value)) : base,
    );
    if (url.protocol !== "https:") return null;
    if (!hasTemplate) url.searchParams.set("amount", value);
    return url.toString();
  } catch {
    return null;
  }
}
