import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { getFullProfile } from "../src/api/profile";
import { useAuthStore } from "../src/store/authStore";
import { hasSeenIntro } from "../src/store/onboardingStorage";
import { hydrateWizardDraft, resetWizardDraft } from "../src/store/wizardHydrate";
import { resolveWizardResumeRoute, type WizardRoute } from "../src/utils/wizardResume";
import { getProfileLoadErrorMessage, isUnauthorizedError } from "../src/utils/authRecovery";
import { RunpuyButton, RunpuyText } from "../src/design-system/components";
import { useRunpuyTheme } from "../src/design-system/theme-context";

export default function Index() {
  const { theme } = useRunpuyTheme();
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [introChecked, setIntroChecked] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRetry, setProfileRetry] = useState(0);
  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [resumeRoute, setResumeRoute] = useState<WizardRoute>("/(profile)/wizard/step-1");

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
      resetWizardDraft();
      setProfileChecked(false);
      setProfileError(null);
      return;
    }

    if (!introChecked || !introSeen) {
      setProfileChecked(false);
      return;
    }

    let cancelled = false;

    setProfileChecked(false);
    setProfileError(null);

    getFullProfile()
      .then((profile) => {
        if (cancelled) return;
        hydrateWizardDraft(profile);
        setWizardCompleted(!!profile?.wizardCompleted);
        setResumeRoute(resolveWizardResumeRoute(profile));
        setProfileChecked(true);
      })
      .catch((error) => {
        if (cancelled) return;
        if (isUnauthorizedError(error)) return;
        setProfileError(getProfileLoadErrorMessage(error));
        setProfileChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, introChecked, introSeen, profileRetry]);

  if (isLoading || !introChecked || (isAuthenticated && introSeen && !profileChecked)) {
    return (
      <View
        style={{
          backgroundColor: theme.colors.canvas,
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <RunpuyText variant="body">Loading...</RunpuyText>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!introSeen) {
    return <Redirect href="/(onboarding)/intro" />;
  }

  if (profileError) {
    return (
      <View
        style={{
          backgroundColor: theme.colors.canvas,
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 16,
        }}
      >
        <RunpuyText accessibilityLiveRegion="polite" variant="body" style={{ textAlign: "center" }}>
          {profileError}
        </RunpuyText>
        <RunpuyButton label="Try Again" onPress={() => setProfileRetry((attempt) => attempt + 1)} />
      </View>
    );
  }

  if (!wizardCompleted) {
    return <Redirect href={resumeRoute} />;
  }

  return <Redirect href="/(tabs)" />;
}
