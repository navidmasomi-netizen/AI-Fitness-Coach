import { useEffect, useMemo } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "../src/store/authStore";
import { RunpuyThemeProvider, useRunpuyTheme } from "../src/design-system/theme-context";
import { runpuyFontSources } from "../src/design-system/fonts";

void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  console.warn("Unable to prevent splash auto-hide for font bootstrap.", error);
});

const queryClient = new QueryClient();

export default function RootLayout() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const isRestoringSession = useAuthStore((s) => s.isLoading);
  const [fontsLoaded, fontError] = useFonts(runpuyFontSources);
  const isReady = !isRestoringSession && (fontsLoaded || fontError !== null);

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (fontError) {
      console.warn("RUNPUY fonts failed to load; using system font fallback.", fontError);
    }
  }, [fontError]);

  useEffect(() => {
    if (!isReady) return;

    void SplashScreen.hideAsync().catch((error: unknown) => {
      console.warn("Unable to hide splash after font bootstrap.", error);
    });
  }, [isReady]);

  if (!isReady) {
    return null;
  }

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
