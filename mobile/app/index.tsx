import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
import { hasSeenIntro } from "../src/store/onboardingStorage";

export default function Index() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [introChecked, setIntroChecked] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      setIntroChecked(true);
      return;
    }

    let cancelled = false;

    setIntroChecked(false);

    hasSeenIntro().then((seen) => {
      if (cancelled) return;
      setIntroSeen(seen);
      setIntroChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated]);

  if (isLoading || !introChecked) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!introSeen) {
    return <Redirect href="/(onboarding)/intro" />;
  }

  return <Redirect href="/(tabs)" />;
}
