# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

Delegated for this native expansion: Expo SDK 57 with React Native TV (`react-native-tvos` 0.86 stable), TypeScript, Expo Router, Expo Image, Expo Video, SQLite, and EAS build profiles. This keeps one React/TypeScript product core while producing genuine iOS, Android, tvOS, and Android TV binaries with platform-specific navigation and focus behavior. The existing Next.js application remains the public web service and API gateway; it is not embedded in the native app.

## Users

- Primary: anime viewers choosing something quickly from a sofa with a remote, then watching without navigating a dense catalogue.
- Primary: phone viewers browsing, searching, saving, watching, and resuming while moving between devices.
- Inferred from the brief: one person may use both contexts and expects one coherent library, progress state, and installation state.

## Product Purpose

Ani Ghost makes an anime catalogue immediately watchable across phone and television. Success means viewers can open the installed app, recognize what matters now, continue in one action, and never be sent through a repeated install or duplicate-download loop.

## Positioning

Ani Ghost pairs a broad sub-and-dub anime catalogue with an intentionally curated front door: the app chooses a small, timely set of useful rows and a clear next action instead of asking viewers to manage the catalogue themselves.

## Operating Context

- TV is a ten-foot, remote-controlled, landscape experience where every action must be reachable through directional focus and Back/Menu behavior.
- Mobile is a touch-first portrait experience with one-handed navigation, safe-area support, a first-class manga reader, and offline episode controls kept close to playback rather than occupying a main tab.
- The native apps consume Ani Ghost's server-side catalogue and signed HLS gateway; they do not expose or embed the existing website.
- A single source project is built into phone and TV variants using separate build profiles and native package identifiers.

## Capabilities and Constraints

- Confirmed: native apps for iOS, Android, tvOS, and Android TV; no WebView shell.
- Confirmed: excellent artwork fidelity, deliberate curation, mobile and remote-native navigation, and no repeated instruction to download an app that is already installed.
- Confirmed: generated design-study characters never ship. Catalogue artwork comes only from AniGhost's backend or its existing artwork resolvers, and Mobile Home does not duplicate Search—the single entry point is the Search item in the floating navigation island.
- Confirmed from the repository: catalogue, title, episode, server, source, artwork, subtitles, skip-intro/outro, sub/dub, and signed HLS proxy capabilities already exist.
- Confirmed from the repository: saves, preferences, and playback progress are currently device-local; cross-device sync requires a backend data migration.
- Installation binaries and store listings are not yet available. Store IDs, signing teams, privacy disclosures, and production EAS project IDs remain open release decisions.
- Download identity is canonical per account/title/episode/audio/quality. Repeated requests must resolve to the existing queued, active, or completed record instead of creating a second transfer.
- Commercial claims, licensing claims, and release availability must not be invented.

## Brand Commitments

- Preserve the Ani Ghost name, ghost mark, title-treatment artwork, and existing dark violet/pink identity.
- Apple TV and Netflix are the explicit craft and usability benchmarks: cinematic art direction, restrained chrome, immediate continuation, predictable shelves, and unmistakable focus—not visual assets or a literal clone.
- Copy is direct and viewer-centered. The app says what can be watched or continued; it does not narrate implementation details or repeatedly promote installation after install.

## Evidence on Hand

- Existing product implementation and tokens: `app/globals.css`, `app/layout.tsx`, and `components/`.
- Brand assets: `public/brand/ani-ghost-hero.png` and `public/brand/ani-ghost-compact.png`.
- Catalogue and stream gateway: `lib/backend.ts`, `lib/stream.ts`, `lib/artwork.ts`, `app/api/ag/[...path]/route.ts`, and `app/api/hls/route.ts`.
- Existing mobile and TV behavior hypotheses: `components/MobileDock.tsx` and `components/TVNavigationManager.tsx`.
- Existing device-local state: `lib/progress.ts`, `lib/saves.ts`, and `lib/prefs.ts`.
- No native simulator captures, signed binaries, app-store listings, customer evidence, or verified cross-device sync are currently present.

## Product Principles

1. Open into the next useful action, not a marketing or installation screen.
2. Curate before adding more rows; every shelf must answer a different viewer question.
3. Treat artwork as content: request the largest sensible source, cache it, preserve its crop, and never upscale a soft thumbnail into a hero.
4. Make state singular and durable: one progress record, one save, and one download identity across retries and devices.
5. Adapt interaction by device while keeping the same content model and brand.
6. Give every global action one obvious home; Search appears once in mobile navigation, not again as Home-screen chrome.

## Accessibility & Inclusion

- Every TV action must be reachable and visibly focused with a remote; focus order must remain stable when rows virtualize or content loads.
- Respect reduced motion, large text, screen readers, captions, contrast, and safe areas.
- Mobile touch targets are at least 44×44 points; TV labels and controls are legible at ten feet and never communicate state through motion alone.
