import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Platform, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { FocusablePressable } from "@/components/focusable-pressable";
import { colors, layout, radii, spacing, typography } from "@/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function ActionButton({
  label,
  icon,
  onPress,
  variant = "secondary",
  disabled,
  style,
  hasTVPreferredFocus,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  hasTVPreferredFocus?: boolean;
}) {
  const isTV = Platform.isTV;
  return (
    <FocusablePressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={[
        styles.base,
        isTV ? styles.tvBase : styles.phoneBase,
        variant === "primary"
          ? styles.primary
          : variant === "quiet"
            ? styles.quiet
            : styles.secondary,
        style,
      ]}
    >
      {icon ? (
        <Ionicons
          color={variant === "primary" ? colors.text : colors.text}
          name={icon}
          size={isTV ? 30 : 20}
        />
      ) : null}
      <Text style={[styles.label, isTV ? styles.tvLabel : styles.phoneLabel]}>{label}</Text>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
  },
  phoneBase: {
    minHeight: layout.phone.minimumTapTarget,
    paddingHorizontal: spacing.lg,
  },
  tvBase: {
    minHeight: layout.tv.minimumFocusTarget,
    paddingHorizontal: spacing.xl,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surfaceStrong,
  },
  quiet: {
    backgroundColor: colors.scrim,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    color: colors.text,
    fontWeight: typography.weight.bold,
  },
  phoneLabel: {
    fontSize: typography.phone.body,
  },
  tvLabel: {
    fontSize: typography.tv.body,
  },
});
