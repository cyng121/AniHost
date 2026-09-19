import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View } from "react-native";

import { Artwork } from "@/components/artwork";
import { FocusablePressable } from "@/components/focusable-pressable";
import { colors, layout, radii, spacing, typography } from "@/theme";

export function PosterCard({
  title,
  imageUrl,
  meta,
  onPress,
}: {
  title: string;
  imageUrl: string | null | undefined;
  meta?: string | null;
  onPress: () => void;
}) {
  const isTV = Platform.isTV;
  const width = isTV ? layout.tv.posterWidth : layout.phone.posterWidth;

  return (
    <FocusablePressable
      accessibilityLabel={meta ? `${title}. ${meta}` : title}
      accessibilityRole="button"
      containerStyle={{ width }}
      onPress={onPress}
      style={styles.posterPressable}
    >
      <Artwork
        label={`${title} poster`}
        priority="normal"
        style={[styles.poster, { width }]}
        uri={imageUrl}
      />
      <Text
        numberOfLines={2}
        style={[styles.posterTitle, isTV ? styles.posterTitleTV : null]}
      >
        {title}
      </Text>
      {meta ? (
        <Text numberOfLines={1} style={[styles.meta, isTV ? styles.metaTV : null]}>
          {meta}
        </Text>
      ) : null}
    </FocusablePressable>
  );
}

export function ContinueCard({
  title,
  imageUrl,
  episode,
  progress,
  onPress,
}: {
  title: string;
  imageUrl: string | null | undefined;
  episode: number;
  progress: number;
  onPress: () => void;
}) {
  const isTV = Platform.isTV;
  const width = isTV ? 420 : 252;
  const boundedProgress = Math.max(0, Math.min(1, progress));

  return (
    <FocusablePressable
      accessibilityLabel={`Continue ${title}, episode ${episode}, ${Math.round(boundedProgress * 100)} percent watched`}
      accessibilityRole="button"
      containerStyle={{ width }}
      onPress={onPress}
      style={styles.continuePressable}
    >
      <Artwork
        label={`${title} episode ${episode}`}
        style={[styles.landscape, { width }]}
        uri={imageUrl}
      />
      <View style={styles.progressTrack}>
        <View style={[styles.progressValue, { width: `${boundedProgress * 100}%` }]} />
      </View>
      <View style={styles.continueCopy}>
        <View style={styles.continueText}>
          <Text numberOfLines={1} style={[styles.posterTitle, isTV ? styles.posterTitleTV : null]}>
            {title}
          </Text>
          <Text style={[styles.meta, isTV ? styles.metaTV : null]}>Episode {episode}</Text>
        </View>
        <Ionicons color={colors.textMuted} name="play-circle-outline" size={isTV ? 34 : 24} />
      </View>
    </FocusablePressable>
  );
}

export function LandscapeCard({
  title,
  imageUrl,
  meta,
  onPress,
}: {
  title: string;
  imageUrl: string | null | undefined;
  meta?: string | null;
  onPress: () => void;
}) {
  const isTV = Platform.isTV;
  const width = isTV ? 380 : 252;

  return (
    <FocusablePressable
      accessibilityLabel={meta ? `${title}. ${meta}` : title}
      accessibilityRole="button"
      containerStyle={{ width }}
      onPress={onPress}
      style={styles.continuePressable}
    >
      <Artwork
        label={`${title} artwork`}
        priority="high"
        style={[styles.landscape, { width }]}
        uri={imageUrl}
      />
      <View style={styles.continueCopy}>
        <View style={styles.continueText}>
          <Text numberOfLines={1} style={[styles.posterTitle, isTV ? styles.posterTitleTV : null]}>
            {title}
          </Text>
          {meta ? <Text style={[styles.meta, isTV ? styles.metaTV : null]}>{meta}</Text> : null}
        </View>
      </View>
    </FocusablePressable>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: string }) {
  const isTV = Platform.isTV;
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, isTV ? styles.sectionTitleTV : null]}>{title}</Text>
      {action ? (
        <View style={styles.sectionAction}>
          <Text style={[styles.actionText, isTV ? styles.actionTextTV : null]}>{action}</Text>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={isTV ? 28 : 18} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  posterPressable: {
    overflow: "hidden",
  },
  poster: {
    aspectRatio: layout.posterAspectRatio,
    borderRadius: radii.md,
  },
  posterTitle: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: typography.phone.body,
    lineHeight: 21,
    fontWeight: typography.weight.semibold,
  },
  posterTitleTV: {
    marginTop: spacing.sm,
    fontSize: typography.tv.caption,
    lineHeight: 31,
  },
  meta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: typography.phone.caption,
    fontWeight: typography.weight.medium,
  },
  metaTV: {
    marginTop: spacing.xs,
    fontSize: typography.tv.micro,
  },
  continuePressable: {
    overflow: "hidden",
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  landscape: {
    aspectRatio: layout.backdropAspectRatio,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceStrong,
  },
  progressValue: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  continueCopy: {
    minHeight: 54,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  continueText: {
    flex: 1,
  },
  sectionTitleRow: {
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: typography.phone.title,
    lineHeight: 34,
    fontWeight: typography.weight.bold,
    letterSpacing: -0.5,
  },
  sectionTitleTV: {
    fontSize: typography.tv.title,
    lineHeight: 58,
    letterSpacing: -1,
  },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionText: {
    color: colors.textMuted,
    fontSize: typography.phone.caption,
    fontWeight: typography.weight.semibold,
  },
  actionTextTV: {
    fontSize: typography.tv.micro,
  },
});
