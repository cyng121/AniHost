# Ani Ghost native foundation

This directory is the shared Expo SDK 57 source project for real iOS, Android,
tvOS, and Android TV binaries. It uses Expo Router and `react-native-tvos`; it
does not embed the Next.js site and does not depend on `react-native-webview`.

Expo is intentionally pinned to `57.0.13`, whose compatibility map targets
React Native 0.86.2. The requested `react-native-tvos@0.86-stable` tag currently
resolves to the matching 0.86.2 TV fork. Upgrade both together when that stable
tag advances; allowing Expo to float to the 0.86.3 patch creates a native binary
compatibility mismatch.

The current routes are deliberately only a compile-ready shell. Product screens
should be added on top of these contracts rather than treating the shell as a
finished interface.

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer
- Xcode with the tvOS SDK for iOS/tvOS work
- Android Studio with phone and Android TV system images for Android work
- EAS CLI for cloud builds

## First setup

From this directory:

```powershell
Copy-Item .env.example .env
npm install
npx expo install --check
npm run typecheck
```

Set `EXPO_PUBLIC_API_ORIGIN` to the public origin serving this repository's
`/api/native/*` routes. A physical device must be able to reach that origin;
the device's `localhost` is not the development computer.

The project uses a development client because Expo Go cannot represent the TV
native target. Build a development client before starting Metro.

## Run phone and TV variants

```powershell
# Phone
npm run prebuild:phone
npm run android
# or: npm run ios
npm run start:phone

# TV (the clean prebuild is required when switching target families)
npm run prebuild:tv
npm run android:tv
# or, on macOS with the tvOS SDK: npm run ios:tv
npm run start:tv
```

`android/` and `ios/` are generated Continuous Native Generation output and are
ignored. Always run the matching clean prebuild after changing `EXPO_TV`.

Metro supports shared modules plus target overrides such as `player.tv.tsx`,
`player.android.tv.tsx`, and `player.ios.tv.tsx`.

## EAS builds

Link the project once with EAS and place the resulting UUID in
`EAS_PROJECT_ID`. The checked-in profiles are:

| Target | Development | Preview | Production |
| --- | --- | --- | --- |
| Phone | `development_phone` | `preview_phone` | `production_phone` |
| TV | `development_tv` | `preview_tv` | `production_tv` |

Example:

```powershell
npx eas build --profile development_phone --platform android
npx eas build --profile development_tv --platform android
```

Phone defaults to `com.anighost.app`; TV defaults to `com.anighost.tv`. Override
the four identifier variables in `.env`/EAS before credentials are created if
the reserved store identifiers differ. tvOS provisioning and Android TV store
art remain release setup, not assumptions made by this foundation.

## Linking placeholders

The `anighost://` custom scheme works from `ANIGHOST_APP_SCHEME`. Universal and
Android App Links are intentionally disabled while
`ANIGHOST_UNIVERSAL_LINK_HOST` is empty. Before enabling a real hostname:

1. Serve a valid Apple `apple-app-site-association` file for every iOS/tvOS app
   identifier.
2. Serve `/.well-known/assetlinks.json` with the Android application IDs and
   signing fingerprints.
3. Set `ANIGHOST_UNIVERSAL_LINK_HOST` to only the hostname, without a scheme or
   path, and rebuild the native binaries.

## Native API

`src/api` matches the currently exposed gateway routes:

- `GET /api/native/home`
- `GET /api/native/search?q=...&page=...`
- `GET /api/native/title/:slug`

Use the shared client directly or inject a fetch implementation for tests:

```ts
import { nativeApi } from "@/api";

const home = await nativeApi.getHome();
const results = await nativeApi.search("Frieren", { page: 1 });
```

The client preserves backend error codes, applies a finite timeout, and accepts
an `AbortSignal` for screen lifecycle cancellation. Its response types mirror
the route payloads; add types and methods when new `/api/native/*` routes land.

## Product contracts

- The phone primary navigation is exactly **Home · Search · Manga · Saved ·
  Profile** (`src/navigation/primary-nav.ts`). Downloads are episode/playback
  actions and are not a primary tab.
- Search appears once in the mobile navigation destination. Do not add a second
  search field to Home.
- Catalogue posters, backdrops, logos, episode stills, and manga covers must use
  URLs supplied by `/api/native/*`. Never ship generated characters, design-board
  imagery, or invented local catalogue fallbacks.
- `native/design` is process history only and is excluded from runtime code.
- Brand marks used for the app icon and splash come from the existing repository
  brand assets; they are not catalogue artwork.
- Do not add a WebView shell or a web platform fallback.

## Foundation map

```text
app.config.ts            variant IDs, plugins, deep/app-link configuration
eas.json                 phone and TV build profiles
metro.config.js          Expo Metro config and TV file extensions
babel.config.js          babel-preset-expo
tsconfig.json            strict TypeScript and @/* -> src/*
src/app/                 minimal Expo Router entry
src/api/                 typed /api/native client and response contracts
src/navigation/          stable navigation contracts (no rendered tabs yet)
src/theme/               shared phone/TV tokens
src/data/                local persistence owned by the data layer
```
