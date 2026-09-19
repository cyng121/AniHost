import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { nativeApi, type NativeMangaHero, type NativeMangaHomeResponse } from "@/api";
import { ActionButton } from "@/components/action-button";
import { Artwork } from "@/components/artwork";
import { PosterCard, SectionTitle } from "@/components/content-cards";
import { ErrorState, LoadingState } from "@/components/screen-state";
import { colors, layout, radii, spacing, typography } from "@/theme";

export function MangaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<NativeMangaHomeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void nativeApi
      .getMangaHome({ signal: controller.signal })
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "The manga shelves did not answer.");
        }
      })
      .finally(() => setRefreshing(false));
    return () => controller.abort();
  }, [reloadKey]);

  const refresh = () => {
    setRefreshing(true);
    setReloadKey((value) => value + 1);
  };

  if (!data && !error) return <LoadingState label="Opening manga shelves" />;
  if (!data && error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  const open = (id: string) =>
    router.push({ pathname: "/manga/[id]", params: { id } } as Href);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, spacing.lg) }]}
      refreshControl={
        <RefreshControl
          colors={[colors.accent]}
          onRefresh={refresh}
          refreshing={refreshing}
          tintColor={colors.accent}
        />
      }
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Manga</Text>
        <Text style={styles.subtitle}>Fresh chapters and the canon, chosen for reading.</Text>
      </View>

      {data.hero ? <MangaHero hero={data.hero} onOpen={() => open(data.hero!.id)} /> : null}

      {data.shelves.slice(0, 6).map((shelf) => (
        <View key={shelf.id} style={styles.section}>
          <View style={styles.sectionHeading}>
            <SectionTitle title={shelf.title} />
          </View>
          <ScrollView
            contentContainerStyle={styles.rail}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {shelf.items.map((item) => (
              <PosterCard
                imageUrl={item.posterUrl}
                key={item.id}
                meta={item.type ?? "Manga"}
                onPress={() => open(item.id)}
                title={item.title}
              />
            ))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

function MangaHero({ hero, onOpen }: { hero: NativeMangaHero; onOpen: () => void }) {
  const meta = [
    hero.type,
    hero.status,
    hero.totalChapters ? `${hero.totalChapters} chapters` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.hero}>
      <Artwork
        label={`${hero.title} manga backdrop`}
        priority="high"
        style={StyleSheet.absoluteFillObject}
        uri={hero.backdropUrl}
      />
      <LinearGradient
        colors={["rgba(8,7,14,0.10)", "rgba(8,7,14,0.68)", colors.canvas]}
        locations={[0, 0.54, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.heroLayout}>
        <View style={styles.heroCopy}>
          <Text numberOfLines={3} style={styles.heroTitle}>{hero.title}</Text>
          {meta ? <Text style={styles.heroMeta}>{meta}</Text> : null}
          {hero.synopsis ? <Text numberOfLines={4} style={styles.heroSynopsis}>{hero.synopsis}</Text> : null}
          <ActionButton icon="book-outline" label="Open manga" onPress={onOpen} variant="primary" />
        </View>
        <Artwork
          label={`${hero.title} cover`}
          priority="high"
          style={styles.heroPoster}
          uri={hero.posterUrl}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: 120 },
  header: { paddingHorizontal: layout.phone.gutter, paddingBottom: spacing.lg },
  title: { color: colors.text, fontSize: 36, lineHeight: 42, fontWeight: typography.weight.black, letterSpacing: -0.9 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted, fontSize: typography.phone.caption },
  hero: { minHeight: 500, marginHorizontal: layout.phone.gutter, overflow: "hidden", justifyContent: "flex-end", borderRadius: radii.lg, backgroundColor: colors.surface },
  heroLayout: { padding: spacing.md, paddingTop: 190, flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  heroCopy: { flex: 1, alignItems: "flex-start", gap: spacing.sm },
  heroPoster: { width: 118, aspectRatio: layout.posterAspectRatio, borderRadius: radii.md },
  heroTitle: { color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: typography.weight.black, letterSpacing: -0.7 },
  heroMeta: { color: colors.text, fontSize: typography.phone.caption, fontWeight: typography.weight.semibold },
  heroSynopsis: { color: colors.textMuted, fontSize: typography.phone.caption, lineHeight: 19 },
  section: { marginTop: spacing.xl },
  sectionHeading: { paddingHorizontal: layout.phone.gutter },
  rail: { gap: layout.phone.railGap, paddingHorizontal: layout.phone.gutter, paddingBottom: spacing.sm },
});
