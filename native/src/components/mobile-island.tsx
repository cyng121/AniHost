import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FocusablePressable } from "@/components/focusable-pressable";
import { colors, layout, radii, spacing, typography } from "@/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

const ITEM: Record<string, { label: string; active: IconName; idle: IconName }> = {
  home: { label: "Home", active: "home", idle: "home-outline" },
  search: { label: "Search", active: "search", idle: "search-outline" },
  movies: { label: "Movies", active: "film", idle: "film-outline" },
  manga: { label: "Manga", active: "book", idle: "book-outline" },
  profile: { label: "Profile", active: "person", idle: "person-outline" },
};

export function MobileIsland({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
    >
      <View accessibilityRole="tablist" style={styles.island}>
        {state.routes.map((route, index) => {
          const definition = ITEM[route.name];
          if (!definition) return null;
          const selected = state.index === index;
          const options = descriptors[route.key]?.options;

          return (
            <FocusablePressable
              accessibilityLabel={options?.tabBarAccessibilityLabel ?? definition.label}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={route.key}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!selected && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={[styles.item, selected ? styles.itemSelected : null]}
            >
              <Ionicons
                color={selected ? colors.accentHot : colors.textMuted}
                name={selected ? definition.active : definition.idle}
                size={24}
              />
              <Text numberOfLines={1} style={[styles.label, selected ? styles.labelSelected : null]}>
                {definition.label}
              </Text>
            </FocusablePressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  island: {
    width: "100%",
    maxWidth: 560,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.xs,
    borderRadius: 30,
    backgroundColor: "rgba(24, 23, 35, 0.98)",
    borderColor: colors.lineStrong,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.48,
    shadowRadius: 22,
    elevation: 18,
  },
  item: {
    minWidth: layout.phone.minimumTapTarget,
    minHeight: 60,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: radii.xl,
  },
  itemSelected: {
    backgroundColor: colors.accentWash,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.phone.micro,
    fontWeight: typography.weight.medium,
  },
  labelSelected: {
    color: colors.accentHot,
    fontWeight: typography.weight.bold,
  },
});
