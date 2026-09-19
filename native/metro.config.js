const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// TV builds resolve `thing.tv.tsx` before `thing.tsx`. Metro still applies its
// normal platform pass, so `thing.ios.tv.tsx` and `thing.android.tv.tsx` work too.
if (process.env.EXPO_TV === "1" || process.env.EXPO_TV === "true") {
  const sourceExts = config.resolver.sourceExts;
  config.resolver.sourceExts = [
    ...sourceExts.map((extension) => `tv.${extension}`),
    ...sourceExts,
  ];
}

module.exports = config;
