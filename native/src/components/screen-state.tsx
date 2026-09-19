import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { FocusablePressable } from "@/components/focusable-pressable";
import { colors, layout, spacing, typography } from "@/theme";

export function LoadingState({ label = "Loading AniGhost" }: { label?: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.root}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.copy}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.root}>
      <Ionicons color={colors.accentHot} name="cloud-offline-outline" size={34} />
      <Text style={styles.title}>AniGhost could not load this</Text>
      <Text style={styles.copy}>{message}</Text>
      <FocusablePressable
        accessibilityLabel="Try loading again"
        accessibilityRole="button"
        onPress={onRetry}
        style={styles.retry}
      >
        <Ionicons color={colors.text} name="refresh" size={20} />
        <Text style={styles.retryText}>Try again</Text>
      </FocusablePressable>
    </View>
  );
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.root}>
      <Ionicons color={colors.textSubtle} name="sparkles-outline" size={34} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.copy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  title: {
    maxWidth: layout.phone.maxContentWidth,
    color: colors.text,
    fontSize: typography.phone.title,
    fontWeight: typography.weight.bold,
    textAlign: "center",
  },
  copy: {
    maxWidth: 560,
    color: colors.textMuted,
    fontSize: typography.phone.body,
    lineHeight: 24,
    textAlign: "center",
  },
  retry: {
    minHeight: layout.phone.minimumTapTarget,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  retryText: {
    color: colors.text,
    fontSize: typography.phone.body,
    fontWeight: typography.weight.bold,
  },
});
