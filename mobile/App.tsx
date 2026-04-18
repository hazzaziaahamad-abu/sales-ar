import React from "react";
import { StatusBar } from "expo-status-bar";
import { I18nManager } from "react-native";
import { AuthProvider } from "./src/lib/auth-context";
import AppNavigator from "./src/navigation/AppNavigator";

I18nManager.forceRTL(true);
I18nManager.allowRTL(true);

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </AuthProvider>
  );
}
