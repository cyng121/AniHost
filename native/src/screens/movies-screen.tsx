import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { nativeApi, type NativeMoviesResponse } from '@/api';
import { PosterCard, SectionTitle } from '@/components/content-cards';
import { ErrorState, LoadingState } from '@/components/screen-state';
import { colors, layout, radii, spacing, typography } from '@/theme';

export function MoviesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<NativeMoviesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void nativeApi
      .getMovies({ signal: controller.signal })
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Movie listings did not load.');
        }
      })
      .finally(() => setRefreshing(false));
    return () => controller.abort();
  }, [reloadKey]);

  const refresh = () => {
    setRefreshing(true);
    setReloadKey((v) => v + 1);
  };

  if (!data && !error) return <LoadingState label='Loading movies' />;
  if (!data && error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  const open = (slug: string) =>
    router.push({ pathname: '/title/[slug]', params: { slug } } as Href);

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
        <Text style={styles.title}>Movies</Text>
        <Text style={styles.subtitle}>Films, OVAs and web series — ready to watch.</Text>
      </View>

      {data.shelves.map((shelf) => (
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
                key={item.slug}
                meta={item.duration ?? item.type ?? null}
                onPress={() => open(item.slug)}
                title={item.title}
              />
            ))}
          </ScrollView>
        </View>
      ))}

      <View style={styles.footer}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>HD · SUB · DUB</Text>
        </View>
        <Text style={styles.footerText}>All titles stream in HD where available.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: 130 },
  header: { paddingHorizontal: layout.phone.gutter, paddingBottom: spacing.xl },
  title: { color: colors.text, fontSize: 36, lineHeight: 42, fontWeight: typography.weight.black, letterSpacing: -0.9 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted, fontSize: typography.phone.caption },
  section: { marginTop: spacing.xl },
  sectionHeading: { paddingHorizontal: layout.phone.gutter },
  rail: { gap: layout.phone.railGap, paddingHorizontal: layout.phone.gutter, paddingBottom: spacing.sm },
  footer: { marginTop: spacing.xl, paddingHorizontal: layout.phone.gutter, alignItems: 'flex-start', gap: spacing.xs },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.surface },
  badgeText: { color: colors.textMuted, fontSize: typography.phone.micro, fontWeight: typography.weight.bold, letterSpacing: 0.6 },
  footerText: { color: colors.textSubtle, fontSize: typography.phone.micro },
});