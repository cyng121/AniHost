/**
 * One dark, cinema-first system shared by phone and TV. Values are plain React
 * Native primitives so screens never need to parse CSS variables or web color
 * functions at runtime.
 */
export const colors = {
  canvas: "#161522",
  surface: "#1E1D2C",
  surfaceRaised: "#262537",
  surfaceStrong: "#2F2D44",
  text: "#F4F2FF",
  textMuted: "rgba(244, 242, 255, 0.72)",
  textSubtle: "rgba(244, 242, 255, 0.58)",
  line: "rgba(190, 180, 255, 0.13)",
  lineStrong: "rgba(190, 180, 255, 0.23)",
  accent: "#FF3D8F",
  accentHot: "#FF6BA8",
  accentPressed: "#D41A6C",
  accentWash: "rgba(255, 61, 143, 0.12)",
  accentLine: "rgba(255, 61, 143, 0.30)",
  violet: "#7C2AE8",
  cyan: "#22D3EE",
  success: "#52D89A",
  warning: "#FFBE55",
  danger: "#FF646D",
  scrim: "rgba(7, 6, 12, 0.64)",
  scrimStrong: "rgba(7, 6, 12, 0.86)",
  glass: "rgba(22, 21, 34, 0.82)",
  focus: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 64,
  hero: 88,
} as const;

export const radii = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  phone: {
    micro: 11,
    caption: 13,
    body: 16,
    lead: 20,
    title: 28,
    display: 48,
  },
  tv: {
    micro: 20,
    caption: 24,
    body: 28,
    lead: 34,
    title: 48,
    display: 76,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    black: "900",
  },
} as const;

export const motion = {
  instant: 80,
  fast: 140,
  base: 240,
  deliberate: 360,
  imageFade: 180,
  focusScale: 1.06,
  pressedScale: 0.98,
} as const;

export const layout = {
  phone: {
    gutter: 16,
    railGap: 12,
    minimumTapTarget: 48,
    posterWidth: 142,
    maxContentWidth: 760,
  },
  tv: {
    safeInsetHorizontal: 80,
    safeInsetVertical: 48,
    railGap: 22,
    minimumFocusTarget: 64,
    posterWidth: 238,
    maxContentWidth: 1760,
  },
  posterAspectRatio: 2 / 3,
  backdropAspectRatio: 16 / 9,
} as const;

export const focus = {
  ringColor: colors.focus,
  ringWidth: 3,
  ringOffset: 4,
  scale: motion.focusScale,
  glowColor: "rgba(255, 255, 255, 0.22)",
} as const;

export const tokens = {
  colors,
  spacing,
  radii,
  typography,
  motion,
  layout,
  focus,
} as const;

export type AniGhostTokens = typeof tokens;
