import { useEffect, useMemo } from "react";
import { Stack } from "expo-router";
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "../src/store/authStore";
import { RunpuyThemeProvider, useRunpuyTheme } from "../src/design-system/theme-context";

const queryClient = new QueryClient();

export default function RootLayout() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RunpuyThemeProvider>
        <ThemedRootStack />
      </RunpuyThemeProvider>
    </QueryClientProvider>
  );
}

function ThemedRootStack() {
  const { scheme, theme } = useRunpuyTheme();
  const navigationTheme = useMemo(() => {
    const baseTheme = scheme === "dark" ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      dark: scheme === "dark",
      colors: {
        ...baseTheme.colors,
        primary: theme.colors.actionPrimary,
        background: theme.colors.canvas,
        card: theme.colors.card,
        text: theme.colors.textPrimary,
        border: theme.colors.borderSubtle,
        notification: theme.colors.information,
      },
    };
  }, [scheme, theme]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </NavigationThemeProvider>
  );
}
