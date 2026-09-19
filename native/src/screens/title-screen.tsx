import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { nativeApi, type NativeEpisode, type NativeTitleResponse } from "@/api";
import { ActionButton } from "@/components/action-button";
import { Artwork } from "@/components/artwork";
import { FocusablePressable } from "@/components/focusable-pressable";
import { PosterCard, SectionTitle } from "@/components/content-cards";
import { ErrorState, LoadingState } from "@/components/screen-state";
import { DEVICE_PROFILE_ID } from "@/config/profile";
import { getAniGhostDataStore } from "@/data";
import { colors, layout, radii, spacing, typography } from "@/theme";

export function TitleScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<NativeTitleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!slug) {
      setError("This title link is incomplete.");
      return;
    }
    const controller = new AbortController();
    setError(null);
    void nativeApi
      .getTitle(slug, { signal: controller.signal })
      .then(async (response) => {
        setData(response);
        const store = await getAniGhostDataStore();
        setSaved(
          await store.saves.isSaved({
            profileId: DEVICE_PROFILE_ID,
            contentId: response.title.slug,
          }),
        );
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "This title did not load.");
        }
      });
    return () => controller.abort();
  }, [reloadKey, slug]);

  const playable = useMemo(
    () => data?.episodes.filter((episode) => episode.sub || episode.dub) ?? [],
    [data],
  );

  if (!data && !error) return <LoadingState label="Opening title" />;
  if (!data && error) {
    return <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }
  if (!data) return null;

  const { title } = data;
  const firstEpisode = playable[0];
  const watch = (episode: NativeEpisode) => {
    router.push({
      pathname: "/watch/[slug]",
      params: {
        slug: title.slug,
        episode: String(episode.number),
        ids: episode.ids,
        audio: episode.sub ? "sub" : "dub",
      },
    } as Href);
  };

  const toggleSave = async () => {
    const store = await getAniGhostDataStore();
    const result = await store.saves.toggle({
      profileId: DEVICE_PROFILE_ID,
      contentId: title.slug,
      contentType: "anime",
      slug: title.slug,
      title: title.title,
      imageUri: title.posterUrl,
      rating: title.score,
      qualityLabel: title.quality,
      totalEpisodesOrChapters: title.totalEpisodes ? String(title.totalEpisodes) : null,
    });
    setSaved(result.saved);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.backRow, { paddingTop: Math.max(insets.top, spacing.md) }]}> 
          <FocusablePressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons color={colors.text} name="arrow-back" size={Platform.isTV ? 32 : 23} />
          </FocusablePressable>
        </View>

        <View style={styles.hero}>
          <Artwork
            label={`${title.title} backdrop`}
            priority="high"
            style={StyleSheet.absoluteFillObject}
            uri={title.backdropUrl}
          />
          <LinearGradient
            colors={["rgba(9,8,15,0.08)", colors.canvas]}
            locations={[0.32, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroCopy}>
            {title.logoUrl ? (
              <Image
                accessibilityLabel={title.title}
                cachePolicy="memory-disk"
                contentFit="contain"
                priority="high"
                source={{ uri: title.logoUrl }}
                style={styles.logo}
              />
            ) : (
              <Text style={styles.title}>{title.title}</Text>
            )}
            <Text style={styles.meta}>{titleMeta(title)}</Text>
            {title.synopsis ? <Text style={styles.synopsis}>{title.synopsis}</Text> : null}
            <View style={styles.actions}>
              <ActionButton
                disabled={!firstEpisode}
                hasTVPreferredFocus
                icon="play"
                label={firstEpisode ? `Watch episode ${firstEpisode.number}` : "No playable episode"}
                onPress={() => firstEpisode && watch(firstEpisode)}
                variant="primary"
              />
              <ActionButton
                icon={saved ? "bookmark" : "bookmark-outline"}
                label={saved ? "Saved" : "Watch later"}
                onPress={() => void toggleSave()}
              />
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {title.genres.length ? (
            <View style={styles.genres}>
              {title.genres.map((genre) => (
                <View key={genre} style={styles.genre}>
                  <Text style={styles.genreText}>{genre}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionTitle title="Episodes" />
            {data.episodeError ? <Text style={styles.inlineError}>{data.episodeError}</Text> : null}
            <View style={styles.episodes}>
              {data.episodes.map((episode) => (
                <EpisodeRow episode={episode} key={episode.ids} onPress={() => watch(episode)} />
              ))}
            </View>
          </View>

          {data.related.length ? (
            <View style={styles.section}>
              <SectionTitle title="More like this" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.related}>
                  {data.related.map((item) => (
                    <PosterCard
                      imageUrl={item.posterUrl}
                      key={item.slug}
                      meta={item.type}
                      onPress={() =>
                        router.push({ pathname: "/title/[slug]", params: { slug: item.slug } } as Href)
                      }
                      title={item.title}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function EpisodeRow({ episode, onPress }: { episode: NativeEpisode; onPress: () => void }) {
  const isTV = Platform.isTV;
  const available = episode.sub || episode.dub;
  return (
    <FocusablePressable
      accessibilityLabel={`${episode.title}. Episode ${episode.number}${available ? "" : ". Unavailable"}`}
      accessibilityRole="button"
      disabled={!available}
      onPress={onPress}
      style={styles.episode}
    >
      <Artwork
        label={`${episode.title} thumbnail`}
        style={[styles.episodeArt, isTV ? styles.episodeArtTV : null]}
        uri={episode.thumbnailUrl}
      />
      <View style={styles.episodeCopy}>
        <Text style={[styles.episodeNumber, isTV ? styles.episodeNumberTV : null]}>
          Episode {episode.number}
        </Text>
        <Text numberOfLines={2} style={[styles.episodeTitle, isTV ? styles.episodeTitleTV : null]}>
          {episode.title}
        </Text>
        <Text style={[styles.episodeTracks, isTV ? styles.episodeTracksTV : null]}>
          {[episode.sub ? "SUB" : null, episode.dub ? "DUB" : null].filter(Boolean).join(" · ") || "Not available"}
        </Text>
      </View>
      <Ionicons color={colors.textMuted} name="play-circle" size={isTV ? 42 : 28} />
    </FocusablePressable>
  );
}

function titleMeta(title: NativeTitleResponse["title"]): string {
  return [title.type, title.year, title.quality, title.score ? `★ ${title.score}` : null]
    .filter(Boolean)
    .join(" · ");
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: Platform.isTV ? layout.tv.safeInsetVertical : spacing.xxl },
  backRow: { position: "absolute", zIndex: 3, left: Platform.isTV ? layout.tv.safeInsetHorizontal : layout.phone.gutter },
  backButton: { width: Platform.isTV ? 64 : 48, height: Platform.isTV ? 64 : 48, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.scrimStrong },
  hero: { minHeight: Platform.isTV ? 720 : 610, justifyContent: "flex-end", backgroundColor: colors.surface },
  heroCopy: { maxWidth: Platform.isTV ? 940 : 720, paddingHorizontal: Platform.isTV ? layout.tv.safeInsetHorizontal : layout.phone.gutter, paddingBottom: Platform.isTV ? layout.tv.safeInsetVertical : spacing.xl, paddingTop: Platform.isTV ? 260 : 250 },
  logo: { width: Platform.isTV ? 620 : "76%", height: Platform.isTV ? 220 : 128, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: Platform.isTV ? typography.tv.display : typography.phone.display, lineHeight: Platform.isTV ? 84 : 52, fontWeight: typography.weight.black, letterSpacing: Platform.isTV ? -1.8 : -1.1 },
  meta: { color: colors.text, fontSize: Platform.isTV ? typography.tv.caption : typography.phone.caption, fontWeight: typography.weight.semibold },
  synopsis: { maxWidth: Platform.isTV ? 900 : 680, marginTop: spacing.md, color: colors.textMuted, fontSize: Platform.isTV ? typography.tv.body : typography.phone.body, lineHeight: Platform.isTV ? 40 : 24 },
  actions: { marginTop: spacing.lg, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  body: { paddingHorizontal: Platform.isTV ? layout.tv.safeInsetHorizontal : layout.phone.gutter },
  genres: { marginTop: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  genre: { minHeight: Platform.isTV ? 54 : 38, paddingHorizontal: Platform.isTV ? spacing.lg : spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.surface },
  genreText: { color: colors.textMuted, fontSize: Platform.isTV ? typography.tv.micro : typography.phone.caption, fontWeight: typography.weight.semibold },
  section: { marginTop: Platform.isTV ? spacing.section : spacing.xl },
  inlineError: { marginBottom: spacing.md, color: colors.warning, fontSize: typography.phone.caption },
  episodes: { gap: spacing.sm },
  episode: { minHeight: Platform.isTV ? 158 : 104, padding: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface },
  episodeArt: { width: 128, aspectRatio: layout.backdropAspectRatio },
  episodeArtTV: { width: 230 },
  episodeCopy: { flex: 1 },
  episodeNumber: { color: colors.accentHot, fontSize: typography.phone.micro, fontWeight: typography.weight.bold },
  episodeNumberTV: { fontSize: typography.tv.micro },
  episodeTitle: { marginTop: 3, color: colors.text, fontSize: typography.phone.body, fontWeight: typography.weight.semibold },
  episodeTitleTV: { marginTop: spacing.xs, fontSize: typography.tv.body },
  episodeTracks: { marginTop: 4, color: colors.textMuted, fontSize: typography.phone.micro, fontWeight: typography.weight.medium },
  episodeTracksTV: { fontSize: typography.tv.micro },
  related: { flexDirection: "row", gap: Platform.isTV ? layout.tv.railGap : layout.phone.railGap, paddingBottom: spacing.lg },
});
