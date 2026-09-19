/**
 * THESIS: AniGhost's recognisable mobile identity becomes a direct native front
 * door: one real title, one watch action, and only the rows useful right now.
 * OWN-WORLD: ink-violet canvas, hot-pink action, white ghost mark, real backend
 * artwork, dark pill controls, and one floating navigation island.
 * STORY: open into Watch/Resume, scan genres, continue, then browse fresh rows.
 * FIRST VIEWPORT: ghost/sign-in header plus a tall cinematic hero and primary CTA.
 * FORM: established AniGhost mobile canon, refined to native phone behavior.
 * FINISH: the result should feel like AniGhost on a phone—not a website in a shell.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { nativeApi, type NativeCard, type NativeHomeResponse } from "@/api";
import { ActionButton } from "@/components/action-button";
import { Artwork } from "@/components/artwork";
import { BrandHeader } from "@/components/brand-header";
import { ContinueCard, PosterCard, SectionTitle } from "@/components/content-cards";
import { ErrorState, LoadingState } from "@/components/screen-state";
import { DEVICE_PROFILE_ID } from "@/config/profile";
import { getAniGhostDataStore, type PlaybackProgress } from "@/data";
import { colors, layout, radii, spacing, typography } from "@/theme";

interface HomeState {
  feed: NativeHomeResponse;
  progress: PlaybackProgress[];
}

export function PhoneHomeScreen() {
  const router = useRouter();
  const [state, setState] = useState<HomeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    const [feed, store] = await Promise.all([
      nativeApi.getHome({ signal }),
      getAniGhostDataStore(),
    ]);
    const progress = await store.playback.listRecent(DEVICE_PROFILE_ID, { limit: 12 });
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
          setError(reason instanceof Error ? reason.message : "The catalogue did not answer.");
        }
      })
      .finally(() => setRefreshing(false));
    return () => controller.abort();
  }, [load, reloadKey]);

  const refresh = () => {
    setRefreshing(true);
    setReloadKey((value) => value + 1);
  };

  if (!state && !error) return <LoadingState label="Curating AniGhost" />;
  if (!state && error) return <ErrorState message={error} onRetry={refresh} />;
  if (!state) return null;

  const hero = state.feed.hero;
  const firstEpisode = Math.max(1, hero?.latestEpisode ?? 1);

  const openTitle = (slug: string) => {
    router.push({ pathname: "/title/[slug]", params: { slug } } as Href);
  };
  const watch = (slug: string, episode: number) => {
    router.push({
      pathname: "/watch/[slug]",
      params: { slug, episode: String(episode) },
    } as Href);
  };

  const toggleHeroSave = async () => {
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
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.accent]}
            onRefresh={refresh}
            refreshing={refreshing}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader onSignIn={() => router.push("/profile" as Href)} />
        {hero ? (
          <PhoneHero
            hero={hero}
            onDetails={() => openTitle(hero.slug)}
            onSave={() => void toggleHeroSave()}
            onWatch={() => watch(hero.slug, firstEpisode)}
            saved={saved}
          />
        ) : null}

        {state.feed.genres.length ? <GenreStrip genres={state.feed.genres.slice(0, 12)} /> : null}

        {state.progress.length ? (
          <HomeSection title="Continue watching">
            <ScrollView
              contentContainerStyle={styles.rail}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {state.progress.map((item) => (
                <ContinueCard
                  episode={item.episode}
                  imageUrl={item.imageUri}
                  key={item.contentId}
                  onPress={() => watch(item.slug, item.episode)}
                  progress={item.durationSeconds ? item.positionSeconds / item.durationSeconds : 0}
                  title={item.title}
                />
              ))}
            </ScrollView>
          </HomeSection>
        ) : null}

        {state.feed.shelves.slice(0, 5).map((shelf) => (
          <HomeSection key={shelf.id} title={shelf.title}>
            <ScrollView
              contentContainerStyle={styles.rail}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {shelf.items.map((item) => (
                <PosterCard
                  imageUrl={item.posterUrl}
                  key={item.slug}
                  meta={cardMeta(item)}
                  onPress={() => openTitle(item.slug)}
                  title={item.title}
                />
              ))}
            </ScrollView>
          </HomeSection>
        ))}
      </ScrollView>
    </View>
  );
}

function PhoneHero({
  hero,
  onWatch,
  onSave,
  onDetails,
  saved,
}: {
  hero: NonNullable<NativeHomeResponse["hero"]>;
  onWatch: () => void;
  onSave: () => void;
  onDetails: () => void;
  saved: boolean;
}) {
  const { height } = useWindowDimensions();
  const heroHeight = Math.min(690, Math.max(560, height * 0.72));
  const metadata = [
    hero.type,
    hero.quality,
    hero.subCount != null ? `${hero.subCount} SUB` : null,
    hero.dubCount != null ? `${hero.dubCount} DUB` : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <View style={[styles.hero, { minHeight: heroHeight }]}> 
      <Artwork
        imageStyle={styles.heroImage}
        label={`${hero.title} backdrop`}
        priority="high"
        style={StyleSheet.absoluteFillObject}
        uri={hero.backdropUrl}
      />
      <LinearGradient
        colors={["rgba(8,7,14,0.10)", "rgba(8,7,14,0.24)", colors.canvas]}
        locations={[0, 0.44, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={["rgba(8,7,14,0.86)", "rgba(8,7,14,0.08)"]}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
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
            style={styles.titleLogo}
          />
        ) : (
          <Text numberOfLines={2} style={styles.heroTitle}>
            {hero.title}
          </Text>
        )}

        <View accessibilityLabel={metadata.join(", ")} style={styles.metadata}>
          {metadata.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.metaItem}>
              {index ? <View style={styles.metaDot} /> : null}
              <Text style={styles.metaText}>{item}</Text>
            </View>
          ))}
        </View>

        {hero.synopsis ? (
          <Text numberOfLines={3} style={styles.synopsis}>
            {hero.synopsis}
          </Text>
        ) : null}

        <ActionButton
          icon="play"
          label="Watch now"
          onPress={onWatch}
          style={styles.watchButton}
          variant="primary"
        />
        <View style={styles.heroSecondaryActions}>
          <ActionButton
            icon={saved ? "bookmark" : "bookmark-outline"}
            label={saved ? "Saved" : "Watch later"}
            onPress={onSave}
            style={styles.secondaryButton}
          />
          <ActionButton
            icon="information-circle-outline"
            label="Details"
            onPress={onDetails}
            style={styles.secondaryButton}
          />
        </View>
      </View>
    </View>
  );
}

function GenreStrip({ genres }: { genres: string[] }) {
  return (
    <ScrollView
      contentContainerStyle={styles.genres}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {genres.map((genre, index) => (
        <View key={genre} style={[styles.genre, index === 0 ? styles.genreActive : null]}>
          {index === 0 ? <Ionicons color={colors.accentHot} name="star" size={14} /> : null}
          <Text style={[styles.genreText, index === 0 ? styles.genreTextActive : null]}>
            {genre}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function HomeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <SectionTitle action="See all" title={title} />
      </View>
      {children}
    </View>
  );
}

function cardMeta(item: NativeCard): string | null {
  const episode = item.latestEpisode ?? item.episodeCount;
  const parts = [episode ? `EP ${episode}` : null, item.quality, item.type].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    paddingBottom: 116,
  },
  hero: {
    marginHorizontal: layout.phone.gutter,
    overflow: "hidden",
    justifyContent: "flex-end",
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  heroImage: {
    borderRadius: radii.lg,
  },
  heroCopy: {
    width: "100%",
    maxWidth: 580,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: 180,
  },
  titleLogo: {
    width: "74%",
    maxWidth: 360,
    height: 112,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    maxWidth: 420,
    marginBottom: spacing.sm,
    color: colors.text,
    fontSize: typography.phone.display,
    lineHeight: 50,
    fontWeight: typography.weight.black,
    letterSpacing: -1.2,
  },
  metadata: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaDot: {
    width: 4,
    height: 4,
    marginHorizontal: spacing.xs,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
  },
  metaText: {
    color: colors.text,
    fontSize: typography.phone.caption,
    fontWeight: typography.weight.semibold,
  },
  synopsis: {
    maxWidth: 520,
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: typography.phone.body,
    lineHeight: 23,
  },
  watchButton: {
    width: "100%",
    marginTop: spacing.md,
  },
  heroSecondaryActions: {
    marginTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  genres: {
    gap: spacing.xs,
    paddingHorizontal: layout.phone.gutter,
    paddingVertical: spacing.lg,
  },
  genre: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    borderColor: colors.lineStrong,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
  },
  genreActive: {
    borderColor: colors.accentLine,
    backgroundColor: colors.accentWash,
  },
  genreText: {
    color: colors.textMuted,
    fontSize: typography.phone.caption,
    fontWeight: typography.weight.semibold,
  },
  genreTextActive: {
    color: colors.accentHot,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionHeading: {
    paddingHorizontal: layout.phone.gutter,
  },
  rail: {
    gap: layout.phone.railGap,
    paddingHorizontal: layout.phone.gutter,
    paddingBottom: spacing.sm,
  },
});
