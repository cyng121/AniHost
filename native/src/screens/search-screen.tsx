import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { nativeApi, type NativeCard, type NativeMangaCard } from "@/api";
import { Artwork } from "@/components/artwork";
import { EmptyState } from "@/components/screen-state";
import { FocusablePressable } from "@/components/focusable-pressable";
import { colors, layout, radii, spacing, typography } from "@/theme";

type Scope = "anime" | "manga";
type Result =
  | { key: string; scope: "anime"; item: NativeCard }
  | { key: string; scope: "manga"; item: NativeMangaCard };

export function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("anime");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      const request =
        scope === "anime"
          ? nativeApi.search(term, { signal: controller.signal })
          : nativeApi.searchManga(term, { signal: controller.signal });

      void request
        .then((response) => {
          if (scope === "anime" && "page" in response) {
            setResults(
              response.items.map((item) => ({ key: `anime:${item.slug}`, scope, item })),
            );
          } else if (scope === "manga" && "items" in response) {
            setResults(
              response.items.map((item) => ({ key: `manga:${item.id}`, scope, item })),
            );
          }
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setError(reason instanceof Error ? reason.message : "Search did not answer.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 320);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, scope]);

  const term = query.trim();
  const status = useMemo(() => {
    if (loading) return `Searching ${scope}`;
    if (error) return error;
    if (term.length >= 2) return `${results.length} ${scope} result${results.length === 1 ? "" : "s"}`;
    return "Search titles, characters, or alternate names.";
  }, [error, loading, results.length, scope, term.length]);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, spacing.lg) }]}> 
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.subtitle}>One search, across anime and manga.</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons color={colors.textMuted} name="search" size={24} />
        <TextInput
          accessibilityLabel="Search AniGhost"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="never"
          onChangeText={setQuery}
          onSubmitEditing={() => Keyboard.dismiss()}
          placeholder={scope === "anime" ? "Search anime" : "Search manga"}
          placeholderTextColor={colors.textSubtle}
          ref={input}
          returnKeyType="search"
          selectionColor={colors.accent}
          style={styles.input}
          value={query}
        />
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        {!loading && query ? (
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => {
              setQuery("");
              input.current?.focus();
            }}
          >
            <Ionicons color={colors.textMuted} name="close-circle" size={24} />
          </Pressable>
        ) : null}
      </View>

      <View accessibilityRole="tablist" style={styles.scopes}>
        {(["anime", "manga"] as const).map((item) => (
          <FocusablePressable
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === item }}
            key={item}
            onPress={() => setScope(item)}
            style={[styles.scope, scope === item ? styles.scopeActive : null]}
          >
            <Text style={[styles.scopeText, scope === item ? styles.scopeTextActive : null]}>
              {item === "anime" ? "Anime" : "Manga"}
            </Text>
          </FocusablePressable>
        ))}
      </View>

      <Text accessibilityLiveRegion="polite" style={[styles.status, error ? styles.error : null]}>
        {status}
      </Text>

      <FlatList
        columnWrapperStyle={results.length > 1 ? styles.row : undefined}
        contentContainerStyle={results.length ? styles.grid : styles.emptyList}
        data={results}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.key}
        ListEmptyComponent={
          term.length < 2 ? (
            <EmptyState
              copy="Type at least two characters, then switch between Anime and Manga without leaving this screen."
              title="What do you want next?"
            />
          ) : !loading && !error ? (
            <EmptyState
              copy="Try a shorter title or an alternate spelling."
              title={`No ${scope} matches “${term}”`}
            />
          ) : null
        }
        numColumns={2}
        renderItem={({ item }) => {
          const card = item.item;
          const id = item.scope === "anime" ? card.slug : card.id;
          return (
            <FocusablePressable
              accessibilityLabel={`${card.title}. ${item.scope}`}
              accessibilityRole="button"
              containerStyle={styles.cardColumn}
              onPress={() =>
                router.push(
                  item.scope === "anime"
                    ? ({ pathname: "/title/[slug]", params: { slug: id } } as Href)
                    : ({ pathname: "/manga/[id]", params: { id } } as Href),
                )
              }
              style={styles.card}
            >
              <Artwork label={`${card.title} poster`} style={styles.poster} uri={card.posterUrl} />
              <Text numberOfLines={2} style={styles.cardTitle}>{card.title}</Text>
              <Text numberOfLines={1} style={styles.cardMeta}>{card.type ?? item.scope}</Text>
            </FocusablePressable>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: layout.phone.gutter },
  title: { color: colors.text, fontSize: 36, lineHeight: 42, fontWeight: typography.weight.black, letterSpacing: -0.9 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted, fontSize: typography.phone.caption },
  searchBox: { minHeight: 58, marginTop: spacing.lg, marginHorizontal: layout.phone.gutter, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radii.lg, borderColor: colors.lineStrong, borderWidth: StyleSheet.hairlineWidth, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 56, color: colors.text, fontSize: typography.phone.body, fontWeight: typography.weight.medium },
  scopes: { marginTop: spacing.md, paddingHorizontal: layout.phone.gutter, flexDirection: "row", gap: spacing.xs },
  scope: { minWidth: 96, minHeight: layout.phone.minimumTapTarget, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.surface },
  scopeActive: { backgroundColor: colors.accent },
  scopeText: { color: colors.textMuted, fontSize: typography.phone.caption, fontWeight: typography.weight.semibold },
  scopeTextActive: { color: colors.text },
  status: { minHeight: 42, paddingHorizontal: layout.phone.gutter, paddingTop: spacing.md, color: colors.textMuted, fontSize: typography.phone.caption },
  error: { color: colors.warning },
  grid: { gap: spacing.lg, paddingHorizontal: layout.phone.gutter, paddingTop: spacing.sm, paddingBottom: 120 },
  emptyList: { flexGrow: 1, paddingBottom: 110 },
  row: { gap: spacing.md },
  cardColumn: { flex: 1 },
  card: { flex: 1 },
  poster: { width: "100%", aspectRatio: layout.posterAspectRatio, borderRadius: radii.md },
  cardTitle: { marginTop: spacing.xs, color: colors.text, fontSize: typography.phone.body, lineHeight: 22, fontWeight: typography.weight.semibold },
  cardMeta: { marginTop: 2, color: colors.textMuted, fontSize: typography.phone.caption, textTransform: "capitalize" },
});
