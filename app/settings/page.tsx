export const runtime = "edge";
"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Avatar, CHARACTERS } from "@/components/Avatar";
import { listProgress } from "@/lib/progress";
import { DEFAULTS, readPrefs, writePrefs, type Prefs } from "@/lib/prefs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Footer } from "@/components/Footer";

const DISCORD_URL = process.env.NEXT_PUBLIC_ANIGHOST_DISCORD_URL?.trim() || "https://discord.gg/8QNhUY5ZRH";

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className="seg__b"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [watched, setWatched] = useState(0);
  const [savesCount, setSavesCount] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setPrefs(readPrefs());
    setWatched(listProgress().length);
    try {
      const raw = window.localStorage.getItem("anighost-saves");
      if (raw) setSavesCount(Object.keys(JSON.parse(raw)).length);
    } catch {
      /* ignore */
    }
    const saved = window.localStorage.getItem("anighost-theme");
    setTheme(saved === "light" || saved === "dark" ? saved : "system");

    const client = getSupabaseBrowserClient();
    if (client) {
      client.auth.getUser().then(({ data }) => {
        if (data.user) setUser(data.user);
      });
    }

    setReady(true);
  }, []);

  function set<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs(writePrefs({ [key]: value } as Partial<Prefs>));
  }

  async function saveUsername(e: FormEvent) {
    e.preventDefault();
    const clean = nameInput.trim().slice(0, 32);
    setSavingName(true);
    set("username", clean);

    const client = getSupabaseBrowserClient();
    if (client && user) {
      try {
        await client.auth.updateUser({
          data: { name: clean || undefined, full_name: clean || undefined },
        });
        if (clean) {
          await client
            .from("anime_comments")
            .update({ display_name: clean, updated_at: new Date().toISOString() })
            .eq("user_id", user.id);
        }
      } catch {
        /* silent fallback */
      }
    }
    setSavingName(false);
    setEditingName(false);
  }

  function applyTheme(next: "light" | "dark" | "system") {
    setTheme(next);
    if (next === "system") {
      document.documentElement.removeAttribute("data-theme");
      window.localStorage.removeItem("anighost-theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
      window.localStorage.setItem("anighost-theme", next);
    }
  }

  const selectedIndex = ((prefs.character % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
  const character = CHARACTERS[selectedIndex];
  const customName = prefs.username?.trim();
  const rawMetaName = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
  const activeName =
    customName || (typeof rawMetaName === "string" && rawMetaName.trim() ? rawMetaName.trim() : character.name);

  return (
    <main className="wrap page set">
      <header className="page__head">
        <h1>Profile</h1>
        <p className="page__sub">
          Manage your personal anime profile, appearance, and library.
        </p>
      </header>

      {/* ── Minimalist Clean Profile Card ── */}
      <div className="set__idCard">
        <div className="set__idMain">
          <Avatar index={selectedIndex} size="xl" />
          <div className="set__idInfo">
            <b className="set__idTitle">{activeName}</b>
            <span className="set__idSeries">
              {customName ? `Avatar: ${character.name}` : character.series}
            </span>
          </div>
        </div>

        <div className="set__idActions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setNameInput(prefs.username?.trim() || (user ? String(rawMetaName ?? "") : ""));
              setEditingName((prev) => !prev);
            }}
          >
            {customName ? "Edit username" : "Set username"}
          </button>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn--discord btn--sm"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.198.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.0777.0777 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
            </svg>
            <span>Join Discord</span>
          </a>
        </div>

        {editingName ? (
          <form className="set__namePopover" onSubmit={saveUsername}>
            <div className="set__nameHead">
              <b>Set your username</b>
              <span>This name appears on your profile and all reviews.</span>
            </div>
            <div className="set__nameField">
              <input
                type="text"
                className="set__nameInput"
                placeholder="Enter username…"
                value={nameInput}
                maxLength={32}
                autoFocus
                onChange={(e) => setNameInput(e.target.value)}
              />
              <span className="set__nameCount tnum">{nameInput.trim().length}/32</span>
            </div>
            <div className="set__nameActions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setEditingName(false)}
                disabled={savingName}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--primary btn--sm"
                disabled={savingName}
              >
                {savingName ? "Saving…" : "Save username"}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      {/* ── Choose Character Avatar (Horizontal Reel) ── */}
      <section className="set__group">
        <div className="set__labelrow">
          <h2>Character Avatar</h2>
          <span className="set__subHint">Tap to switch character</span>
        </div>
        <div className="char-strip">
          {CHARACTERS.map((c, i) => (
            <button
              key={c.name}
              type="button"
              className={`char-bubble ${selectedIndex === i ? "is-selected" : ""}`}
              aria-label={`Select ${c.name} from ${c.series}`}
              onClick={() => set("character", i)}
            >
              <Avatar index={i} size="lg" />
              <span className="char-bubble__name">{c.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Your Library ── */}
      <section className="set__group">
        <h2>Your Library</h2>
        <div className="set__rows">
          <div className="srow">
            <span className="srow__t">
              <b>Watch Later &amp; Saves</b>
              <span>{savesCount} saved title{savesCount === 1 ? "" : "s"} in your personal library.</span>
            </span>
            <Link className="btn btn--ghost" href="/saves">
              View library
            </Link>
          </div>
          <div className="srow">
            <span className="srow__t">
              <b>Continue Watching History</b>
              <span>{watched} title{watched === 1 ? "" : "s"} in progress.</span>
            </span>
            <Link className="btn btn--ghost" href="/browse#continue">
              View history
            </Link>
          </div>
        </div>
      </section>

      {/* ── Playback & Experience ── */}
      <section className="set__group">
        <h2>Playback &amp; Appearance</h2>
        <div className="set__rows">
          <div className="srow">
            <span className="srow__t">
              <b>Preferred Audio</b>
              <span>Default audio track when both are available.</span>
            </span>
            <Segmented
              value={prefs.audio}
              onChange={(v) => set("audio", v as Prefs["audio"])}
              options={[
                { value: "sub", label: "Sub" },
                { value: "dub", label: "Dub" },
              ]}
            />
          </div>

          <div className="srow">
            <span className="srow__t">
              <b>Autoplay Next Episode</b>
              <span>Seamlessly start the next episode when current finishes.</span>
            </span>
            <Segmented
              value={prefs.autoplay ? "on" : "off"}
              onChange={(v) => set("autoplay", v === "on")}
              options={[
                { value: "on", label: "On" },
                { value: "off", label: "Off" },
              ]}
            />
          </div>

          <div className="srow">
            <span className="srow__t">
              <b>Theme</b>
              <span>Visual appearance across all screens.</span>
            </span>
            <Segmented
              value={theme}
              onChange={(v) => applyTheme(v as "light" | "dark" | "system")}
              options={[
                { value: "system", label: "Auto" },
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── Community ── */}
      <section className="set__group">
        <h2>Community &amp; Support</h2>
        <div className="set__rows">
          <div className="srow">
            <span className="srow__t">
              <b>Official Discord</b>
              <span>Chat with anime fans, request shows, and get quick updates.</span>
            </span>
            <a
              className="btn btn--ghost"
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              Join Discord
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
