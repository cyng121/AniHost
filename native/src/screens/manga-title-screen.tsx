import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { nativeApi, type NativeMangaTitleResponse } from "@/api";
import { ActionButton } from "@/components/action-button";
import { Artwork } from "@/components/artwork";
import { FocusablePressable } from "@/components/focusable-pressable";
import { ErrorState, LoadingState } from "@/components/screen-state";
import { DEVICE_PROFILE_ID } from "@/config/profile";
import { getAniGhostDataStore } from "@/data";
import { colors, layout, radii, spacing, typography } from "@/theme";

export function MangaTitleScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<NativeMangaTitleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setError("This manga link is incomplete.");
      return;
    }
    const controller = new AbortController();
    setError(null);
    void nativeApi
      .getMangaTitle(id, { signal: controller.signal })
      .then(async (response) => {
        setData(response);
        const store = await getAniGhostDataStore();
        setSaved(
          await store.saves.isSaved({
            profileId: DEVICE_PROFILE_ID,
            contentId: `manga:${response.title.id}`,
          }),
        );
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "This manga did not load.");
        }
      });
    return () => controller.abort();
  }, [id, reloadKey]);

  const chapters = useMemo(
    () => [...(data?.chapters ?? [])].sort((a, b) => b.number - a.number),
    [data],
  );

  if (!data && !error) return <LoadingState label="Opening manga" />;
  if (!data && error) {
    return <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }
  if (!data) return null;

  const { title } = data;
  const startingChapter = data.chapters[0];
  const openChapter = (chapter: string) =>
    router.push({ pathname: "/manga/[id]/[chapter]", params: { id: title.id, chapter } } as Href);

  const toggleSave = async () => {
    const store = await getAniGhostDataStore();
    const result = await store.saves.toggle({
      profileId: DEVICE_PROFILE_ID,
      contentId: `manga:${title.id}`,
      contentType: "manga",
      slug: title.id,
      title: title.title,
      imageUri: title.posterUrl,
      rating: title.rating == null ? null : String(title.rating),
      totalEpisodesOrChapters: title.totalChapters ? String(title.totalChapters) : null,
    });
    setSaved(result.saved);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} style={styles.root}>
      <View style={[styles.backRow, { paddingTop: Math.max(insets.top, spacing.md) }]}> 
        <FocusablePressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons color={colors.text} name="arrow-back" size={23} />
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
          colors={["rgba(8,7,14,0.06)", "rgba(8,7,14,0.74)", colors.canvas]}
          locations={[0, 0.52, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.heroLayout}>
          <Artwork
            label={`${title.title} cover`}
            priority="high"
            style={styles.poster}
            uri={title.posterUrl}
          />
          <View style={styles.heroCopy}>
            <Text style={styles.title}>{title.title}</Text>
            <Text style={styles.meta}>{mangaMeta(data)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {title.synopsis ? <Text style={styles.synopsis}>{title.synopsis}</Text> : null}
        <View style={styles.actions}>
          <ActionButton
            disabled={!startingChapter}
            icon="book-outline"
            label={startingChapter ? "Start reading" : "No chapters available"}
            onPress={() => startingChapter && openChapter(startingChapter.id)}
            variant="primary"
          />
          <ActionButton
            icon={saved ? "bookmark" : "bookmark-outline"}
            label={saved ? "Saved" : "Read later"}
            onPress={() => void toggleSave()}
          />
        </View>

        {title.genres.length ? (
          <View style={styles.genres}>
            {title.genres.map((genre) => (
              <View key={genre} style={styles.genre}>
                <Text style={styles.genreText}>{genre}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Chapters</Text>
        <View style={styles.chapters}>
          {chapters.map((chapter) => (
            <FocusablePressable
              accessibilityLabel={`Chapter ${chapter.number}${chapter.title ? `. ${chapter.title}` : ""}`}
              accessibilityRole="button"
              key={chapter.id}
              onPress={() => openChapter(chapter.id)}
              style={styles.chapter}
            >
              <View style={styles.chapterCopy}>
                <Text style={styles.chapterNumber}>Chapter {chapter.number}</Text>
                {chapter.title ? <Text numberOfLines={1} style={styles.chapterTitle}>{chapter.title}</Text> : null}
              </View>
              {chapter.pageCount ? <Text style={styles.pageCount}>{chapter.pageCount} pages</Text> : null}
              <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
            </FocusablePressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function mangaMeta(data: NativeMangaTitleResponse): string {
  const title = data.title;
  return [
    title.type,
    title.status,
    title.totalChapters ? `${title.totalChapters} chapters` : null,
    title.rating != null ? `Score ${title.rating}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: spacing.xxl },
  backRow: { position: "absolute", zIndex: 3, left: layout.phone.gutter },
  backButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.scrimStrong },
  hero: { minHeight: 570, justifyContent: "flex-end", backgroundColor: colors.surface },
  heroLayout: { paddingHorizontal: layout.phone.gutter, paddingBottom: spacing.xl, paddingTop: 250, flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  poster: { width: 126, aspectRatio: layout.posterAspectRatio, borderRadius: radii.md },
  heroCopy: { flex: 1, paddingBottom: spacing.xs },
  title: { color: colors.text, fontSize: 34, lineHeight: 39, fontWeight: typography.weight.black, letterSpacing: -0.7 },
  meta: { marginTop: spacing.sm, color: colors.textMuted, fontSize: typography.phone.caption, lineHeight: 19, fontWeight: typography.weight.semibold },
  body: { paddingHorizontal: layout.phone.gutter },
  synopsis: { color: colors.textMuted, fontSize: typography.phone.body, lineHeight: 25 },
  actions: { marginTop: spacing.lg, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  genres: { marginTop: spacing.lg, flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  genre: { minHeight: 38, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.surface },
  genreText: { color: colors.textMuted, fontSize: typography.phone.caption, fontWeight: typography.weight.semibold },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.text, fontSize: typography.phone.title, fontWeight: typography.weight.bold },
  chapters: { gap: spacing.xs },
  chapter: { minHeight: 70, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surface },
  chapterCopy: { flex: 1 },
  chapterNumber: { color: colors.text, fontSize: typography.phone.body, fontWeight: typography.weight.semibold },
  chapterTitle: { marginTop: 3, color: colors.textMuted, fontSize: typography.phone.caption },
  pageCount: { color: colors.textMuted, fontSize: typography.phone.micro, fontWeight: typography.weight.medium },
});
