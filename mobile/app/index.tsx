import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Redirect } from "expo-router";
import { getMyProfile } from "../src/api/profile";
import { useAuthStore } from "../src/store/authStore";
import { hasSeenIntro } from "../src/store/onboardingStorage";

export default function Index() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [introChecked, setIntroChecked] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [wizardCompleted, setWizardCompleted] = useState(false);

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

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      setProfileChecked(false);
      return;
    }

    if (!introChecked || !introSeen) {
      setProfileChecked(false);
      return;
    }

    let cancelled = false;

    setProfileChecked(false);

    getMyProfile()
      .then((profile) => {
        if (cancelled) return;
        setWizardCompleted(!!profile?.wizardCompleted);
        setProfileChecked(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setWizardCompleted(false);
        setProfileChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, introChecked, introSeen]);

  if (isLoading || !introChecked || (isAuthenticated && introSeen && !profileChecked)) {
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

  if (!wizardCompleted) {
    return <Redirect href="/(profile)/wizard-placeholder" />;
  }

  return <Redirect href="/(tabs)" />;
}
