import { Ionicons } from "@expo/vector-icons";
import { Image, type ImageContentFit, type ImageProps } from "expo-image";
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, motion, radii, spacing, typography } from "@/theme";

type ArtworkPriority = NonNullable<ImageProps["priority"]>;

export interface ArtworkProps {
  uri: string | null | undefined;
  label: string;
  fit?: ImageContentFit;
  priority?: ArtworkPriority;
  style?: StyleProp<ViewStyle>;
  imageStyle?: ImageProps["style"];
}

/**
 * Renders only catalogue/brand sources supplied by AniGhost. Missing artwork
 * stays visibly missing; the native client never invents a substitute image.
 */
export function Artwork({
  uri,
  label,
  fit = "cover",
  priority = "normal",
  style,
  imageStyle,
}: ArtworkProps) {
  const isTV = Platform.isTV;
  const effectivePriority = isTV ? "high" : priority;

  return (
    <View style={[styles.frame, style]}>
      {uri ? (
        <Image
          accessibilityLabel={label}
          cachePolicy="memory-disk"
          contentFit={fit}
          priority={effectivePriority}
          recyclingKey={uri}
          source={{ uri }}
          style={[StyleSheet.absoluteFillObject, imageStyle]}
          transition={isTV ? 0 : motion.imageFade}
        />
      ) : (
        <View accessibilityLabel={`${label}. Artwork unavailable`} style={styles.missing}>
          <Ionicons color={colors.textSubtle} name="image-outline" size={22} />
          <Text numberOfLines={1} style={styles.missingText}>
            Artwork unavailable
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
  },
  missing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.sm,
  },
  missingText: {
    color: colors.textSubtle,
    fontSize: typography.phone.micro,
    fontWeight: typography.weight.medium,
  },
});
