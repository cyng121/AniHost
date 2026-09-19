# Ani Ghost

Front end for the [apiflix](https://github.com/cyng121/apiflix) backend. Browse the
catalogue, open a title, press play — sub or dub, with subtitles, skip-intro and
resume-where-you-left-off. An optional Supabase connection adds Google/email
accounts, public episode reviews, ratings and live viewer presence.

Next.js 15 (App Router, React 19, TypeScript strict). No UI framework, no CSS
library: one token system in `app/globals.css` drives both themes.

---

## Running it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Nothing else needs configuring — the defaults in
`.env.example` point at the live backend.

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

> Do not run `npm run build` while `npm run dev` is running. They share `.next/`
> and the build replaces the chunks the dev server has open, which makes every
> route 500 until you restart it.

### ⚠️ Move this project out of OneDrive

The project currently lives in `OneDrive\Documents\anime\anighost`, and OneDrive
corrupts `.next` as it is being written. The failures move around, which makes
them look like code bugs — they are not:

```
Cannot find module './611.js'
Cannot find module './chunks/vendor-chunks/next.js'
ENOENT: ... .next\required-server-files.json
EINVAL: invalid argument, readlink ... middleware-build-manifest.js
TypeError: __webpack_modules__[moduleId] is not a function
```

That last pair is the giveaway: `EINVAL` on `readlink` is OneDrive's Files
On-Demand replacing a real file with a placeholder reparse point. A build can
report success while its manifests never land.

Copying the project to a path outside OneDrive fixes it completely — same code,
no errors. Do one of:

1. **Move the project** to something like `C:\dev\anighost` (best).
2. Exclude the folder from sync — OneDrive → Settings → Account → Choose folders.
3. Pause OneDrive while developing.

`distDir` pointed outside the project is *not* a workaround: Next generates
relative type imports that break when the output escapes the project root.

### Environment

| Variable | Default | Why |
| --- | --- | --- |
| `ANIGHOST_API_BASE` | `https://backend.senpaiflix.fun` | Backend origin |
| `ANIGHOST_API_ORIGIN` | `https://senpaiflix.fun` | Sent as `Origin`; must match the backend's allowlist |
| `ANIGHOST_SITE_ORIGIN` | API origin | Public HTTPS origin for social-preview metadata |
| `ANIGHOST_CACHE_SECONDS` | `300` | Default revalidate window for upstream GETs |
| `TMDB_API_READ_TOKEN` | — | Optional. Enables title-treatment artwork (see below) |
| `TMDB_API_KEY` | — | Optional. v3 fallback if you have no v4 token |
| `NEXT_PUBLIC_ANIGHOST_WINDOWS_URL` | — | Signed Windows installer shown on `/apps` |
| `NEXT_PUBLIC_ANIGHOST_MAC_URL` | — | Signed macOS disk image shown on `/apps` |
| `NEXT_PUBLIC_ANIGHOST_LINUX_URL` | — | Linux AppImage shown on `/apps` |
| `NEXT_PUBLIC_ANIGHOST_ANDROID_URL` | — | Android APK shown on `/apps` |
| `NEXT_PUBLIC_ANIGHOST_ANDROID_TV_URL` | — | Android TV APK shown on `/apps` |
| `NEXT_PUBLIC_ANIGHOST_SUPPORT_URL` | — | HTTPS payment link; `{amount}` is replaced with the viewer's chosen amount |
| `NEXT_PUBLIC_SUPABASE_URL` | — | Optional Supabase project URL for accounts and community features |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | — | Browser-safe publishable key; never use a secret/service-role key |

To enable the community, apply the SQL migration in `supabase/migrations`, add
the two public Supabase values above, and enable Google plus email/password in
Supabase Auth. Without those values, watching remains fully available and the
community UI clearly stays in an unconnected state.

---

## The two problems this app exists to solve

Everything else is ordinary Next.js. These two are not, and they are why the
data layer looks the way it does.

### 1. The backend refuses browser requests

`apiflix/middleware.ts` rejects any request whose `Origin` is not on its
allowlist, and rejects requests carrying neither `Origin` nor `Referer`
("Direct browser access denied"). A browser cannot forge either header.

So every catalogue call happens **server-side** in `lib/backend.ts`, which sets
the allowlisted `Origin`, applies a 25s timeout, and returns a
`Result<T>` union instead of throwing. Pages render whatever succeeded and show
a written explanation for whatever did not. The backend host is never exposed
to the client.

### 2. The stream CDNs are hotlink-protected

Requesting `master.m3u8` directly returns **403**. The same request with
`Referer: https://megaplay.buzz/` returns **200**. Again, not something a
browser can do.

`app/api/hls/route.ts` is the proxy that makes playback possible:

- fetches with the correct `Referer` and a browser `User-Agent`
- **rewrites every URI inside each playlist** so variants, segments, keys and
  subtitle tracks all route back through the proxy — otherwise the browser
  would request segment 2 directly and get a 403 mid-episode
- resolves relative URIs against the *final* URL after redirects
- forces the correct `Content-Type` by file extension, because the CDN serves
  WebVTT as `application/octet-stream` (which the browser silently drops) and
  segments as `image/jpeg`
- converts SubRip to WebVTT, since `<track>` does not accept `.srt`
- **SSRF guard**: http/https only; loopback, private, link-local and cloud
  metadata hosts are refused

Playlists are `no-store` (their URLs are short-lived and signed); segments get
`private, max-age=600` so seeking does not refetch what you already watched.

---

## Layout

```
app/
  page.tsx                  Landing
  browse/                   Home: spotlight, rails, top rated, schedule, genres
  anime/[slug]/             Title detail + episode list + Start/Continue
  watch/[slug]/[ep]/        Player, episodes, community reviews + ratings
  search/                   Search results, paginated
  genre/[genre]/            Real genre listings (not a title search)
  schedule/                 Broadcast calendar, day by day
  settings/                 Character picker, playback + appearance prefs
  apps/                     Device-aware native app download centre
  games/  manga/            Status pages — see Known gaps
  api/random/               Redirects to a random title (the shuffle button)
  api/hls/                  The stream proxy described above
  api/ag/[...path]/         Read-only passthrough to the backend, prefix-allowlisted
lib/
  backend.ts                Server-only API client (Origin, timeout, Result<T>)
  catalogue.ts              loadTitle() + present() — the field-cleaning layer
  stream.ts                 Server/source resolution with fallback
  types.ts                  Shapes read off live responses
  progress.ts               Watch progress in localStorage
  supabase/browser.ts       Publishable browser client for auth/realtime
components/                 Header, Player, Spotlight, rails, cards
```

### Choosing a stream

`lib/stream.ts` walks every server for the requested audio track, and if all of
them fail, falls back to the other track rather than stranding the viewer. One
server failing is normal — links expire and hosts rotate. If a source dies
*during* playback, `WatchStage` rotates to the next server by changing a URL
param, so the recovery re-runs on the server with no stale client state.

The `ids` and `linkId` values are opaque base64 and are passed through
**verbatim**. Re-encoding them breaks playback.

### Field cleaning

The scrapers write `"Unknown"`, `"?"`, `"N/A"`, `""` and raw entities like
`"&NBSP ?"` interchangeably. Everything user-visible goes through `present()`
in `lib/catalogue.ts`, so the UI omits a fact rather than printing
"Aired: Unknown". `/zoro/info` already carries the episode list, so the common
path is one request; `/zoro/episodes` is a fallback for titles that come back
without it.

### Title treatments

The hero and the title page render each show's **real logo lettering** rather
than its name set in our own typeface. The artwork comes from TMDB, which is
the only source in reach that carries transparent title treatments — neither
apiflix nor AniList expose them, so `lib/artwork.ts` talks to TMDB directly,
server-side.

Two details make it work in practice:

- **A query cascade.** Provider titles are far more granular than TMDB's, which
  indexes a franchise under one entry. "Bleach: Thousand-Year Blood War - The
  Calamity" does not exist there. So the full name is tried first (a distinct
  show should not collapse into its parent), then the stem before the dash, then
  before the colon, then the Japanese title. Measured coverage across the live
  catalogue is **25/26 (96%)** — the miss was a Chinese donghua.
- **A halo, not an invert.** Most of these are white-on-transparent PNGs: fine
  over the hero's dark artwork, invisible on a light page. Light mode adds a
  dark drop-shadow halo, which keeps coloured logos honest while making white
  ones readable.

The name is never lost: it ships as the image's `alt`, so screen readers, search
engines and anyone with images off get the title. With no TMDB key configured
`findTitleLogo` returns null everywhere and titles render as plain text —
nothing breaks, it just looks plainer.

`lib/logo.ts` exists because a resolved logo is passed into client components
(the spotlight is one). Importing anything from the server-only `artwork.ts` —
even one pure function — pulls `server-only` into the client bundle and the
build refuses it, so the shape and the URL builder live in their own module.

### Theming

Three states, because the viewer has three: no stamp (follow the OS),
`data-theme="light"`, and `data-theme="dark"`. Tokens are defined for all
three; components only ever reference tokens. A pre-paint script in
`app/layout.tsx` applies the saved choice so the wrong theme never flashes.

---

## Known gaps

These are backend limitations, not missing UI. They are listed because they are
visible on the page.

- **No synopsis, genres, studios or producers on title pages.** `/zoro/info`
  returns these as `""` and `[]` for every title tested. The `/zoro/tooltip/:id`
  endpoint that scrapes them returns **404** upstream even with a valid
  `tooltipId`. The detail page renders correctly without them and will show them
  the moment the backend supplies them.
- **`totalResults` is `0`** on search responses that contain results, so the
  count shown is derived from the items actually returned.
- **Soft 404.** An unknown slug renders the correct not-found page but with HTTP
  200, because the response has already begun streaming when `notFound()` fires.
- **Support needs a payment destination.** Set `NEXT_PUBLIC_ANIGHOST_SUPPORT_URL`
  to an HTTPS checkout or transfer link. Include `{amount}` in provider-specific
  links, for example `https://provider.example/pay/{amount}`; otherwise Ani Ghost
  appends the selected amount as an `amount` query parameter.
- **Voice search is Chromium-only.** It uses the Web Speech API and the mic
  button is hidden entirely where the browser lacks it, rather than shown dead.
- **Preferences and progress remain device-local.** Signing in currently adds
  identity, comments, ratings and live presence; syncing playback preferences
  and watch progress between devices is a separate data migration.

## Deployment

The project is connected to the git repository. Pushing to `main` builds
and promotes to production at anighost.com; every other branch and pull request
gets its own preview URL. Nothing needs to be run by hand.

Root Directory is `.` — the repository root is the Next app.

Environment variables live in the Vercel project, not in the repository. Only
`.env.example` is tracked, and it carries names and explanations, never values.
`ANIGHOST_SITE_ORIGIN` is deliberately left blank there: Vercel supplies the
production domain at build time, so previews resolve canonical URLs to the real
site rather than naming themselves.

One variable is required in production and easy to miss —
`ANIGHOST_PROXY_SECRET`. It signs every `/api/hls` link. Without it the stream
proxy will fetch any URL it is handed, on your bandwidth and your IP.

Build the project only when the dev server is stopped. Running `next build`
against a live `.next` corrupts it, and every route then returns 500 until the
directory is deleted.

## Player controls

Space or `K` play/pause · `←` `→` seek 10s · `F` fullscreen · `M` mute ·
`/` focus search from anywhere.
