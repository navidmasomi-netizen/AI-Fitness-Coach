import Constants from "expo-constants";

// Resolution order:
// 1. EXPO_PUBLIC_API_BASE_URL — explicit, works for all environments.
// 2. Expo/Metro dev server host (dev only) — auto-detected via expo-constants.
// 3. localhost fallback with warning (dev only) — simulator and web only.
// 4. Throw (non-development) — staging/production must set the env var explicitly.
function resolveApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  if (__DEV__) {
    const hostUri =
      Constants.expoConfig?.hostUri ??
      (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
      (Constants as any).manifest?.debuggerHost;

    const host = hostUri ? hostUri.split(":")[0] : null;

    if (host) {
      return `http://${host}:3001/api`;
    }

    // The Expo dev server host could not be detected. This is normal for
    // simulator and web, where localhost is reachable. On a physical device
    // running an EAS development build, this fallback will not connect —
    // set EXPO_PUBLIC_API_BASE_URL in a local .env file instead.
    console.warn(
      "[env] Could not derive the API host from the Expo dev server. " +
        "If you are running on a physical device outside Expo Go, " +
        "set EXPO_PUBLIC_API_BASE_URL in mobile/.env.local."
    );
    return "http://localhost:3001/api";
  }

  throw new Error(
    "[env] EXPO_PUBLIC_API_BASE_URL is required for non-development builds. " +
      "Set it via EAS environment variables or a local .env file before building."
  );
}

export const API_BASE_URL = resolveApiBaseUrl();
