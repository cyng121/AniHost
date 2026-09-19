import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { nativeApi, type NativeCard, type NativeHomeResponse } from "@/api";
import { ActionButton } from "@/components/action-button";
import { Artwork } from "@/components/artwork";
import { ContinueCard, LandscapeCard, PosterCard, SectionTitle } from "@/components/content-cards";
import { FocusablePressable } from "@/components/focusable-pressable";
import { ErrorState, LoadingState } from "@/components/screen-state";
import { DEVICE_PROFILE_ID } from "@/config/profile";
import { getAniGhostDataStore, type PlaybackProgress } from "@/data";
import { colors, layout, radii, spacing, typography } from "@/theme";

const ghostMark = require("../../assets/brand/ani-ghost-compact.png");
type IconName = ComponentProps<typeof Ionicons>["name"];

interface TVState {
  feed: NativeHomeResponse;
  progress: PlaybackProgress[];
}

export function TVHomeScreen() {
  const router = useRouter();
  const [state, setState] = useState<TVState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    const [feed, store] = await Promise.all([
      nativeApi.getHome({ signal }),
      getAniGhostDataStore(),
    ]);
    const progress = await store.playback.listRecent(DEVICE_PROFILE_ID, { limit: 10 });
    return { feed, progress };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void load(controller.signal)
      .then(async (next) => {
        setState(next);
        if (next.feed.hero) {
          const store = await getAniGhostDataStore();
          setSaved(
            await store.saves.isSaved({
              profileId: DEVICE_PROFILE_ID,
              contentId: next.feed.hero.slug,
            }),
          );
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "The TV catalogue did not answer.");
        }
      });
    return () => controller.abort();
  }, [load, reloadKey]);

  if (!state && !error) return <LoadingState label="Curating AniGhost for TV" />;
  if (!state && error) {
    return <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }
  if (!state) return null;

  const hero = state.feed.hero;
  const openTitle = (slug: string) =>
    router.push({ pathname: "/title/[slug]", params: { slug } } as Href);
  const watch = (slug: string, episode: number) =>
    router.push({
      pathname: "/watch/[slug]",
      params: { slug, episode: String(episode) },
    } as Href);

  const toggleSave = async () => {
    if (!hero) return;
    const store = await getAniGhostDataStore();
    const result = await store.saves.toggle({
      profileId: DEVICE_PROFILE_ID,
      contentId: hero.slug,
      contentType: "anime",
      slug: hero.slug,
      title: hero.title,
      imageUri: hero.posterUrl,
      qualityLabel: hero.quality,
      totalEpisodesOrChapters: hero.episodeCount ? String(hero.episodeCount) : null,
    });
    setSaved(result.saved);
  };

  return (
    <View style={styles.root}>
      <TVRail
        onHome={() => undefined}
        onProfile={() => router.push("/profile" as Href)}
        onSaved={() => router.push("/saved" as Href)}
        onSearch={() => router.push("/search" as Href)}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {hero ? (
          <View style={styles.hero}>
            <Artwork
              label={`${hero.title} backdrop`}
              priority="high"
              style={StyleSheet.absoluteFillObject}
              uri={hero.backdropUrl}
            />
            <LinearGradient
              colors={[colors.canvas, "rgba(22,21,34,0.12)", colors.canvas]}
              end={{ x: 1, y: 0.35 }}
              locations={[0, 0.54, 1]}
              start={{ x: 0.1, y: 0.4 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={["rgba(22,21,34,0.02)", colors.canvas]}
              locations={[0.55, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.heroCopy}>
              {hero.logoUrl ? (
                <Image
                  accessibilityLabel={hero.title}
                  cachePolicy="memory-disk"
                  contentFit="contain"
                  priority="high"
                  source={{ uri: hero.logoUrl }}
                  style={styles.heroLogo}
                />
              ) : (
                <Text numberOfLines={2} style={styles.heroTitle}>{hero.title}</Text>
              )}
              <Text style={styles.heroMeta}>{tvMeta(hero)}</Text>
              {hero.synopsis ? (
                <Text numberOfLines={3} style={styles.heroSynopsis}>{hero.synopsis}</Text>
              ) : null}
              <View style={styles.heroActions}>
                <ActionButton
                  hasTVPreferredFocus
                  icon="play"
                  label={hero.latestEpisode ? `Resume Episode ${hero.latestEpisode}` : "Resume Episode 7"}
                  onPress={() => watch(hero.slug, Math.max(1, hero.latestEpisode ?? 1))}
                  variant="primary"
                />
                <ActionButton
                  icon={saved ? "bookmark" : "bookmark-outline"}
                  label={saved ? "In My List" : "My List"}
                  onPress={() => void toggleSave()}
                />
                <ActionButton
                  icon="information-circle-outline"
                  label="Details"
                  onPress={() => openTitle(hero.slug)}
                  variant="quiet"
                />
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.shelves}>
          {state.progress.length ? (
            <TVSection title="Continue watching">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.rail}>
                  {state.progress.map((item) => (
                    <ContinueCard
                      episode={item.episode}
                      imageUrl={item.imageUri}
                      key={item.contentId}
                      onPress={() => watch(item.slug, item.episode)}
                      progress={item.durationSeconds ? item.positionSeconds / item.durationSeconds : 0.65}
                      title={item.title}
                    />
                  ))}
                </View>
              </ScrollView>
            </TVSection>
          ) : null}

          {state.feed.shelves.slice(0, 4).map((shelf) => (
            <TVSection key={shelf.id} title={shelf.title}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.rail}>
                  {shelf.items.slice(0, 14).map((item) => (
                    <LandscapeCard
                      imageUrl={item.backdropUrl || item.posterUrl}
                      key={item.slug}
                      meta={cardMeta(item)}
                      onPress={() => watch(item.slug, Math.max(1, item.latestEpisode ?? 1))}
                      title={item.title}
                    />
                  ))}
                </View>
              </ScrollView>
            </TVSection>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function TVRail({
  onHome,
  onSearch,
  onSaved,
  onProfile,
}: {
  onHome: () => void;
  onSearch: () => void;
  onSaved: () => void;
  onProfile: () => void;
}) {
  const items: Array<{ label: string; icon: IconName; onPress: () => void; active?: boolean; showDot?: boolean }> = [
    { label: "Home", icon: "home", onPress: onHome, active: true, showDot: true },
    { label: "Search", icon: "search-outline", onPress: onSearch },
    { label: "TV", icon: "tv-outline", onPress: () => undefined },
    { label: "My List", icon: "bookmark-outline", onPress: onSaved },
    { label: "Settings", icon: "settings-outline", onPress: onProfile },
  ];

  return (
    <View accessibilityLabel="AniGhost TV navigation" style={styles.navRail}>
      <Image accessibilityLabel="Ani Ghost" contentFit="contain" source={ghostMark} style={styles.navLogo} />
      <View style={styles.navItems}>
        {items.map((item) => (
          <View key={item.label} style={{ position: "relative" }}>
            <FocusablePressable
              accessibilityLabel={item.label}
              accessibilityRole="button"
              onPress={item.onPress}
              style={[styles.navItem, item.active ? styles.navItemActive : null]}
            >
              <Ionicons color={item.active ? colors.text : colors.textMuted} name={item.icon} size={28} />
            </FocusablePressable>
            {item.showDot ? (
              <View
                style={{
                  position: "absolute",
                  right: -4,
                  top: "50%",
                  marginTop: -3,
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: "#ec4899",
                }}
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function TVSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionTitle title={title} />
      {children}
    </View>
  );
}

function tvMeta(item: NativeCard): string {
  return [
    item.type,
    item.quality,
    item.subCount != null ? `${item.subCount} SUB` : null,
    item.dubCount != null ? `${item.dubCount} DUB` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
}

function cardMeta(item: NativeCard): string | null {
  const episode = item.latestEpisode ?? item.episodeCount;
  const parts = [episode ? `EP ${episode}` : null, item.quality].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: layout.tv.safeInsetVertical },
  navRail: {
    position: "absolute",
    zIndex: 10,
    top: layout.tv.safeInsetVertical,
    left: 26,
    bottom: layout.tv.safeInsetVertical,
    width: 78,
    alignItems: "center",
    borderRadius: 32,
    backgroundColor: "rgba(16,15,25,0.96)",
    borderColor: colors.lineStrong,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.46,
    shadowRadius: 26,
    elevation: 18,
  },
  navLogo: { width: 54, height: 54, marginTop: spacing.md },
  navItems: { flex: 1, justifyContent: "center", gap: spacing.md },
  navItem: { width: 62, height: 62, alignItems: "center", justifyContent: "center", borderRadius: radii.xl },
  navItemActive: { backgroundColor: colors.accentWash },
  hero: { minHeight: 720, justifyContent: "center", backgroundColor: colors.surface },
  heroCopy: { width: 960, marginLeft: 146, paddingTop: spacing.xl },
  heroLogo: { width: 610, height: 230, marginBottom: spacing.md },
  heroTitle: { color: colors.text, fontSize: typography.tv.display, lineHeight: 84, fontWeight: typography.weight.black, letterSpacing: -1.8 },
  heroMeta: { color: colors.text, fontSize: typography.tv.caption, fontWeight: typography.weight.semibold },
  heroSynopsis: { maxWidth: 900, marginTop: spacing.md, color: colors.textMuted, fontSize: typography.tv.body, lineHeight: 39 },
  heroActions: { marginTop: spacing.lg, flexDirection: "row", gap: spacing.md },
  shelves: { marginTop: -26, paddingLeft: 146 },
  section: { marginTop: spacing.section },
  rail: { paddingRight: layout.tv.safeInsetHorizontal, paddingBottom: spacing.lg, flexDirection: "row", gap: layout.tv.railGap },
});
