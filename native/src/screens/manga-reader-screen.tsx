import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  nativeApi,
  type NativeMangaChapterResponse,
  type NativeMangaTitleResponse,
} from "@/api";
import { ActionButton } from "@/components/action-button";
import { FocusablePressable } from "@/components/focusable-pressable";
import { ErrorState, LoadingState } from "@/components/screen-state";
import { colors, layout, radii, spacing, typography } from "@/theme";

export function MangaReaderScreen() {
  const { id, chapter } = useLocalSearchParams<{ id?: string; chapter?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pages, setPages] = useState<NativeMangaChapterResponse | null>(null);
  const [title, setTitle] = useState<NativeMangaTitleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id || !chapter) {
      setError("This chapter link is incomplete.");
      return;
    }
    const controller = new AbortController();
    setError(null);
    void Promise.all([
      nativeApi.getMangaChapter(id, chapter, { signal: controller.signal }),
      nativeApi.getMangaTitle(id, { signal: controller.signal }),
    ])
      .then(([chapterResponse, titleResponse]) => {
        setPages(chapterResponse);
        setTitle(titleResponse);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "This chapter did not load.");
        }
      });
    return () => controller.abort();
  }, [chapter, id, reloadKey]);

  const navigation = useMemo(() => {
    if (!title || !chapter) return { current: null, previous: null, next: null };
    const ordered = [...title.chapters].sort((a, b) => a.number - b.number);
    const index = ordered.findIndex((item) => item.id === chapter);
    return {
      current: index >= 0 ? ordered[index] : null,
      previous: index > 0 ? ordered[index - 1] : null,
      next: index >= 0 && index + 1 < ordered.length ? ordered[index + 1] : null,
    };
  }, [chapter, title]);

  if (!pages && !error) return <LoadingState label="Loading chapter pages" />;
  if (!pages && error) {
    return <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }
  if (!pages || !id) return null;

  const goChapter = (chapterId: string) =>
    router.replace({ pathname: "/manga/[id]/[chapter]", params: { id, chapter: chapterId } } as Href);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.sm) }]}> 
        <FocusablePressable
          accessibilityLabel="Back to manga"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons color={colors.text} name="arrow-back" size={23} />
        </FocusablePressable>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.headerTitle}>{title?.title.title ?? "Manga"}</Text>
          <Text style={styles.headerMeta}>
            {navigation.current ? `Chapter ${navigation.current.number}` : "Reader"}
          </Text>
        </View>
        <Text style={styles.pageTotal}>{pages.pages.length} pages</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.reader}>
        {pages.pages.map((page, index) => (
          <Image
            accessibilityLabel={`Page ${page.page}`}
            cachePolicy="memory-disk"
            contentFit="contain"
            key={`${page.page}:${page.imageUrl}`}
            priority={index < 2 ? "high" : "normal"}
            recyclingKey={page.imageUrl}
            source={{ uri: page.imageUrl }}
            style={styles.page}
            transition={120}
          />
        ))}
        <View style={styles.readerEnd}>
          <Text style={styles.endTitle}>End of chapter</Text>
          <View style={styles.endActions}>
            {navigation.previous ? (
              <ActionButton
                icon="chevron-back"
                label={`Chapter ${navigation.previous.number}`}
                onPress={() => goChapter(navigation.previous!.id)}
              />
            ) : null}
            {navigation.next ? (
              <ActionButton
                icon="chevron-forward"
                label={`Chapter ${navigation.next.number}`}
                onPress={() => goChapter(navigation.next!.id)}
                variant="primary"
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: { minHeight: 76, paddingHorizontal: layout.phone.gutter, paddingBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.scrimStrong },
  back: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.surface },
  headerCopy: { flex: 1 },
  headerTitle: { color: colors.text, fontSize: typography.phone.body, fontWeight: typography.weight.bold },
  headerMeta: { marginTop: 2, color: colors.textMuted, fontSize: typography.phone.caption },
  pageTotal: { color: colors.textMuted, fontSize: typography.phone.micro, fontWeight: typography.weight.semibold },
  reader: { flex: 1 },
  page: { width: "100%", aspectRatio: 0.69, backgroundColor: colors.black },
  readerEnd: { minHeight: 260, padding: spacing.xl, alignItems: "center", justifyContent: "center", gap: spacing.lg, backgroundColor: colors.canvas },
  endTitle: { color: colors.text, fontSize: typography.phone.title, fontWeight: typography.weight.bold },
  endActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm },
});
