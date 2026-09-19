import { Tabs } from "expo-router";
import { Platform } from "react-native";

import { MobileIsland } from "@/components/mobile-island";
import { colors } from "@/theme";

export default function PhoneTabsLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.canvas },
        lazy: true,
      }}
      tabBar={(props) => (Platform.isTV ? null : <MobileIsland {...props} />)}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      <Tabs.Screen name="movies" options={{ title: "Movies" }} />
      <Tabs.Screen name="manga" options={{ title: "Manga" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
