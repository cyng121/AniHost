import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useCallback, useState, type ComponentProps } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionButton } from "@/components/action-button";
import { FocusablePressable } from "@/components/focusable-pressable";
import { DEVICE_PROFILE_ID } from "@/config/profile";
import { getAniGhostDataStore } from "@/data";
import { colors, layout, radii, spacing, typography } from "@/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [counts, setCounts] = useState({ saved: 0, progress: 0, offline: 0 });

  useFocusEffect(
    useCallback(() => {
      void getAniGhostDataStore().then(async (store) => {
        const [saved, progress, offline] = await Promise.all([
          store.saves.list(DEVICE_PROFILE_ID),
          store.playback.listRecent(DEVICE_PROFILE_ID, { includeCompleted: true }),
          store.downloads.list(DEVICE_PROFILE_ID, { states: ["downloaded"] }),
        ]);
        setCounts({ saved: saved.length, progress: progress.length, offline: offline.length });
      });
    }, []),
  );

  const clearHistory = () => {
    Alert.alert(
      "Clear playback history?",
      "This removes Continue Watching positions stored on this device. Saved titles stay intact.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear history",
          style: "destructive",
          onPress: () => {
            void getAniGhostDataStore().then((store) =>
              store.playback.clearProfile(DEVICE_PROFILE_ID),
            );
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, spacing.lg), paddingBottom: 120 },
      ]}
      style={styles.root}
    >
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your AniGhost settings and device library.</Text>

      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Ionicons color={colors.text} name="person" size={32} />
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.identityTitle}>Watching on this device</Text>
          <Text style={styles.identityText}>Sign in when account sync is available.</Text>
        </View>
        <ActionButton label="Sign in" onPress={() => undefined} variant="primary" />
      </View>

      <View style={styles.stats}>
        <Stat label="Saved" value={counts.saved} />
        <Stat label="In progress" value={counts.progress} />
        <Stat label="Offline" value={counts.offline} />
      </View>

      <Text style={styles.sectionTitle}>Playback and storage</Text>
      <View style={styles.list}>
        <SettingRow
          detail="Sub when available"
          icon="chatbox-ellipses-outline"
          label="Default audio"
        />
        <SettingRow
          detail="Download controls appear on episodes, never as a duplicate tab"
          icon="download-outline"
          label="Offline episodes"
        />
        <SettingRow
          destructive
          icon="trash-outline"
          label="Clear playback history"
          onPress={clearHistory}
        />
      </View>

      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.list}>
        <SettingRow
          icon="shield-checkmark-outline"
          label="Privacy"
          onPress={() => void Linking.openURL("https://anighost.com/privacy")}
        />
        <SettingRow
          icon="document-text-outline"
          label="Terms"
          onPress={() => void Linking.openURL("https://anighost.com/terms")}
        />
        <SettingRow
          detail={Constants.expoConfig?.version ?? "1.0.0"}
          icon="information-circle-outline"
          label="AniGhost version"
        />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  detail,
  onPress,
  destructive = false,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <FocusablePressable
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      accessibilityRole={onPress ? "button" : "text"}
      disabled={!onPress}
      onPress={onPress}
      style={styles.setting}
    >
      <Ionicons color={destructive ? colors.danger : colors.textMuted} name={icon} size={22} />
      <View style={styles.settingCopy}>
        <Text style={[styles.settingLabel, destructive ? styles.destructive : null]}>{label}</Text>
        {detail ? <Text style={styles.settingDetail}>{detail}</Text> : null}
      </View>
      {onPress ? <Ionicons color={colors.textSubtle} name="chevron-forward" size={20} /> : null}
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: layout.phone.gutter },
  title: {
    color: colors.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: typography.weight.black,
    letterSpacing: -0.9,
  },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted, fontSize: typography.phone.caption },
  identity: {
    marginTop: spacing.xl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    backgroundColor: colors.violet,
  },
  identityCopy: { flex: 1 },
  identityTitle: { color: colors.text, fontSize: typography.phone.body, fontWeight: typography.weight.bold },
  identityText: { marginTop: 3, color: colors.textMuted, fontSize: typography.phone.caption, lineHeight: 18 },
  stats: { marginTop: spacing.md, flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, paddingVertical: spacing.md, alignItems: "center", borderRadius: radii.md, backgroundColor: colors.surface },
  statValue: { color: colors.text, fontSize: 24, fontWeight: typography.weight.black },
  statLabel: { marginTop: 2, color: colors.textMuted, fontSize: typography.phone.micro, fontWeight: typography.weight.semibold },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.text, fontSize: typography.phone.lead, fontWeight: typography.weight.bold },
  list: { overflow: "hidden", borderRadius: radii.lg, backgroundColor: colors.surface },
  setting: { minHeight: 68, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth },
  settingCopy: { flex: 1, paddingVertical: spacing.sm },
  settingLabel: { color: colors.text, fontSize: typography.phone.body, fontWeight: typography.weight.semibold },
  settingDetail: { marginTop: 3, color: colors.textMuted, fontSize: typography.phone.caption, lineHeight: 18 },
  destructive: { color: colors.danger },
});
