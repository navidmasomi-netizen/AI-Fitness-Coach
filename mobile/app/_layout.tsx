import { useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as NavigationBar from "expo-navigation-bar";
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "../src/store/authStore";
import { RunpuyThemeProvider, useRunpuyTheme } from "../src/design-system/theme-context";
import { runpuyFontSources } from "../src/design-system/fonts";
import { colorPrimitives } from "../src/design-system/tokens";

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
      <AuthInvalidationRedirect />
      <RunpuyThemeProvider>
        <ThemedRootStack />
      </RunpuyThemeProvider>
    </QueryClientProvider>
  );
}

function AuthInvalidationRedirect() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    if (wasAuthenticated.current && !isAuthenticated) {
      queryClient.removeQueries({ queryKey: ["myProgram"] });
      queryClient.removeQueries({ queryKey: ["activeSession"] });
      queryClient.removeQueries({ queryKey: ["completedSessions"] });
      queryClient.removeQueries({ queryKey: ["lastSessionProgressions"] });
      queryClient.removeQueries({ queryKey: ["sessionExerciseTargets"] });
      queryClient.removeQueries({ queryKey: ["regenerationRecommendation"] });
      router.replace("/(auth)/login");
    }

    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, isLoading, queryClient, router]);

  return null;
}

function ThemedRootStack() {
  const pathname = usePathname();
  const { scheme, theme } = useRunpuyTheme();
  const usesAuthHero = pathname === "/login";
  const navigationBarBackground = usesAuthHero ? colorPrimitives.nightInk : theme.colors.canvas;
  const navigationBarButtonStyle = usesAuthHero || scheme === "dark" ? "light" : "dark";

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    void Promise.all([
      NavigationBar.setBackgroundColorAsync(navigationBarBackground),
      NavigationBar.setBorderColorAsync(navigationBarBackground),
      NavigationBar.setButtonStyleAsync(navigationBarButtonStyle),
    ]).catch((error: unknown) => {
      console.warn("Unable to update Android navigation bar appearance.", error);
    });
  }, [navigationBarBackground, navigationBarButtonStyle]);

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
