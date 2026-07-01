import * as SecureStore from "expo-secure-store";

const INTRO_SEEN_KEY = "ironfa_intro_seen";

export async function markIntroSeen(): Promise<void> {
  await SecureStore.setItemAsync(INTRO_SEEN_KEY, "true");
}

export async function hasSeenIntro(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(INTRO_SEEN_KEY);
    return value === "true";
  } catch {
    return false;
  }
}
