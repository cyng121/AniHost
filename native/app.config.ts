import type { ConfigContext, ExpoConfig } from "expo/config";

const isTV = process.env.EXPO_TV === "1" || process.env.EXPO_TV === "true";

const apiOrigin = normalizeOrigin(
  process.env.EXPO_PUBLIC_API_ORIGIN ?? "https://anighost.com",
  "EXPO_PUBLIC_API_ORIGIN",
);
const appScheme = requiredScheme(process.env.ANIGHOST_APP_SCHEME ?? "anighost");
const universalLinkHost = optionalHost(process.env.ANIGHOST_UNIVERSAL_LINK_HOST);

const phoneIdentifiers = {
  ios: process.env.ANIGHOST_PHONE_IOS_BUNDLE_ID?.trim() || "com.anighost.app",
  android: process.env.ANIGHOST_PHONE_ANDROID_PACKAGE?.trim() || "com.anighost.app",
};
const tvIdentifiers = {
  ios: process.env.ANIGHOST_TV_IOS_BUNDLE_ID?.trim() || "com.anighost.tv",
  android: process.env.ANIGHOST_TV_ANDROID_PACKAGE?.trim() || "com.anighost.tv",
};
const identifiers = isTV ? tvIdentifiers : phoneIdentifiers;

const appIcon = "./assets/brand/ani-ghost-compact.png";
const adaptiveIcon = "./assets/brand/ani-ghost-hero.png";
const splashImage = "./assets/brand/ani-ghost-compact.png";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isTV ? "Ani Ghost TV" : "Ani Ghost",
  slug: "anighost-native",
  version: "1.0.0",
  scheme: appScheme,
  platforms: ["ios", "android"],
  orientation: isTV ? "landscape" : "default",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  icon: appIcon,
  backgroundColor: "#161522",
  ios: {
    bundleIdentifier: identifiers.ios,
    buildNumber: "1",
    supportsTablet: true,
    icon: appIcon,
    ...(universalLinkHost
      ? { associatedDomains: [`applinks:${universalLinkHost}`] }
      : {}),
  },
  android: {
    package: identifiers.android,
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: adaptiveIcon,
      backgroundColor: "#161522",
    },
    ...(universalLinkHost
      ? {
          intentFilters: [
            {
              action: "VIEW",
              autoVerify: true,
              data: {
                scheme: "https",
                host: universalLinkHost,
                pathPrefix: "/",
              },
              category: ["BROWSABLE", "DEFAULT"],
            },
          ],
        }
      : {}),
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#161522",
        image: splashImage,
        imageWidth: isTV ? 320 : 180,
        resizeMode: "contain",
      },
    ],
    "expo-sqlite",
    [
      "expo-video",
      {
        supportsBackgroundPlayback: false,
        supportsPictureInPicture: !isTV,
      },
    ],
    [
      "@react-native-tvos/config-tv",
      {
        isTV,
        androidTVRequired: isTV,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiOrigin,
    appScheme,
    universalLinkHost,
    buildTarget: isTV ? "tv" : "phone",
    ...(process.env.EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EAS_PROJECT_ID } }
      : {}),
  },
});

function normalizeOrigin(raw: string, variableName: string): string {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    if (url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw new Error(`${variableName} must be an http(s) origin without a path`);
  }
}

function requiredScheme(raw: string): string {
  const scheme = raw.trim().toLowerCase();
  if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) {
    throw new Error("ANIGHOST_APP_SCHEME is not a valid URL scheme");
  }
  return scheme;
}

function optionalHost(raw: string | undefined): string | null {
  const host = raw?.trim().toLowerCase() ?? "";
  if (!host) return null;

  try {
    const url = new URL(`https://${host}`);
    if (url.hostname !== host || url.port || url.pathname !== "/") throw new Error();
    return host;
  } catch {
    throw new Error("ANIGHOST_UNIVERSAL_LINK_HOST must be a hostname without a scheme or path");
  }
}
