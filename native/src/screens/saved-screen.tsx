import { Ionicons } from "@expo/vector-icons";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Artwork } from "@/components/artwork";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { FocusablePressable } from "@/components/focusable-pressable";
import { DEVICE_PROFILE_ID } from "@/config/profile";
import { getAniGhostDataStore, type ContentType, type SavedItem } from "@/data";
import { colors, layout, radii, spacing, typography } from "@/theme";

type Filter = "all" | ContentType;

export function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    void getAniGhostDataStore()
      .then((store) => store.saves.list(DEVICE_PROFILE_ID))
      .then(setItems)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Saved titles could not be read."),
      );
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const visible = useMemo(
    () => (items ?? []).filter((item) => filter === "all" || item.contentType === filter),
    [filter, items],
  );

  if (!items && !error) return <LoadingState label="Opening your library" />;
  if (!items && error) return <ErrorState message={error} onRetry={load} />;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, spacing.lg) }]}> 
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Saved</Text>
          <Text style={styles.subtitle}>Anime and manga you chose to keep.</Text>
        </View>
        <Ionicons color={colors.accentHot} name="bookmark" size={28} />
      </View>

      <View accessibilityRole="tablist" style={styles.filters}>
        {(["all", "anime", "manga"] as const).map((item) => (
          <FocusablePressable
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === item }}
            key={item}
            onPress={() => setFilter(item)}
            style={[styles.filter, filter === item ? styles.filterActive : null]}
          >
            <Text style={[styles.filterText, filter === item ? styles.filterTextActive : null]}>
              {item === "all" ? "All" : item === "anime" ? "Anime" : "Manga"}
            </Text>
          </FocusablePressable>
        ))}
      </View>

      <FlatList
        columnWrapperStyle={visible.length > 1 ? styles.row : undefined}
        contentContainerStyle={visible.length ? styles.grid : styles.emptyList}
        data={visible}
        keyExtractor={(item) => `${item.contentType}:${item.contentId}`}
        ListEmptyComponent={
          <EmptyState
            copy="Use Watch later or Read later on a title. It will appear here once, without duplicates."
            title={filter === "all" ? "Nothing saved yet" : `No saved ${filter}`}
          />
        }
        numColumns={2}
        renderItem={({ item }) => (
          <FocusablePressable
            accessibilityLabel={`${item.title}. ${item.contentType}`}
            accessibilityRole="button"
            containerStyle={styles.cardColumn}
            onPress={() =>
              router.push(
                item.contentType === "manga"
                  ? ({ pathname: "/manga/[id]", params: { id: item.slug } } as Href)
                  : ({ pathname: "/title/[slug]", params: { slug: item.slug } } as Href),
              )
            }
            style={styles.card}
          >
            <Artwork
              label={`${item.title} poster`}
              style={styles.poster}
              uri={item.imageUri}
            />
            <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              {item.contentType === "manga" ? "Manga" : item.qualityLabel ?? "Anime"}
            </Text>
          </FocusablePressable>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    paddingHorizontal: layout.phone.gutter,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: typography.weight.black,
    letterSpacing: -0.9,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: typography.phone.caption,
  },
  filters: {
    marginTop: spacing.lg,
    paddingHorizontal: layout.phone.gutter,
    flexDirection: "row",
    gap: spacing.xs,
  },
  filter: {
    minHeight: layout.phone.minimumTapTarget,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  filterActive: {
    backgroundColor: colors.accent,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: typography.phone.caption,
    fontWeight: typography.weight.semibold,
  },
  filterTextActive: {
    color: colors.text,
  },
  grid: {
    gap: spacing.lg,
    paddingHorizontal: layout.phone.gutter,
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
  emptyList: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  row: {
    gap: spacing.md,
  },
  cardColumn: {
    flex: 1,
  },
  card: {
    flex: 1,
  },
  poster: {
    width: "100%",
    aspectRatio: layout.posterAspectRatio,
    borderRadius: radii.md,
  },
  cardTitle: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: typography.phone.body,
    lineHeight: 22,
    fontWeight: typography.weight.semibold,
  },
  cardMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: typography.phone.caption,
    fontWeight: typography.weight.medium,
  },
});
