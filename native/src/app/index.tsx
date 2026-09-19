import { Redirect } from "expo-router";
import { Platform } from "react-native";

import { TVHomeScreen } from "@/screens/tv-home-screen";

export default function IndexRoute() {
  return Platform.isTV ? <TVHomeScreen /> : <Redirect href="/home" />;
}
