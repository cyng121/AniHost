import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FocusablePressable } from "@/components/focusable-pressable";
import { colors, layout, radii, spacing, typography } from "@/theme";

const ghostMark = require("../../assets/brand/ani-ghost-compact.png");

export function BrandHeader({ onSignIn }: { onSignIn?: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, spacing.sm) }]}> 
      <Image
        accessibilityLabel="Ani Ghost"
        contentFit="contain"
        source={ghostMark}
        style={styles.mark}
      />
      <FocusablePressable
        accessibilityLabel="Sign in to AniGhost"
        accessibilityRole="button"
        onPress={onSignIn}
        style={styles.signIn}
      >
        <Text style={styles.signInText}>Sign in</Text>
      </FocusablePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 76,
    paddingHorizontal: layout.phone.gutter,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.canvas,
  },
  mark: {
    width: 46,
    height: 46,
  },
  signIn: {
    minHeight: layout.phone.minimumTapTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  signInText: {
    color: colors.text,
    fontSize: typography.phone.body,
    fontWeight: typography.weight.bold,
  },
});
