import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { markIntroSeen } from "../../src/store/onboardingStorage";

const onboardingIntroHero = require("../../assets/images/onboarding/onboarding-intro-hero.png");

const BENEFITS = [
  {
    icon: "user-check" as const,
    title: "Personalized for you",
    description: "Every plan is tailored to your goals,\nbody and experience.",
  },
  {
    icon: "cpu" as const,
    title: "Adaptive & smart",
    description: "Your program evolves based on your\nprogress and feedback.",
  },
  {
    icon: "calendar" as const,
    title: "Built around your life",
    description: "We fit your plan to your schedule,\nequipment and lifestyle.",
  },
];

export default function IntroScreen() {
  const router = useRouter();

  const onContinue = async () => {
    await markIntroSeen();
    router.replace("/");
  };

  return (
    <View style={styles.root}>
      <ImageBackground
        source={onboardingIntroHero}
        resizeMode="cover"
        style={styles.background}
        imageStyle={styles.backgroundImage}
        accessible={false}
      >
        <View pointerEvents="none" style={styles.baseTone} />
        <View pointerEvents="none" style={styles.leftReadabilityShade} />
        <View pointerEvents="none" style={styles.topShade} />
        <View pointerEvents="none" style={styles.bottomShade} />

        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.heroSection}>
                <Text style={styles.brand}>AI COACH</Text>

                <View style={styles.headlineBlock}>
                  <Text accessibilityRole="header" style={styles.headline}>
                    Let&apos;s build{"\n"}
                    your <Text style={styles.headlineAccent}>best plan.</Text>
                  </Text>
                  <Text style={styles.supportingCopy}>
                    Answer a few questions so I can create a program that&apos;s built just for you.
                  </Text>
                </View>

                <View style={styles.benefitList}>
                  {BENEFITS.map((benefit) => (
                    <View key={benefit.title} style={styles.benefitRow}>
                      <View style={styles.benefitIcon}>
                        <Feather name={benefit.icon} size={20} color={colors.accent} />
                      </View>
                      <View style={styles.benefitCopy}>
                        <Text style={styles.benefitTitle}>{benefit.title}</Text>
                        <Text style={styles.benefitDescription}>{benefit.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.bottomSection}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Get started with onboarding"
                  hitSlop={8}
                  onPress={onContinue}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                >
                  <Text style={styles.primaryButtonLabel}>Get Started</Text>
                  <Feather name="arrow-right" size={20} color={colors.textPrimary} />
                </Pressable>

                <View style={styles.timeEstimate}>
                  <Feather name="clock" size={15} color={colors.textMuted} />
                  <Text style={styles.timeEstimateText}>Takes about 2–3 minutes</Text>
                </View>

                <View accessible accessibilityRole="text" accessibilityLabel="Onboarding step 1 of 4" style={styles.indicator}>
                  {[0, 1, 2, 3].map((position) => (
                    <View key={position} style={[styles.indicatorDot, position === 0 && styles.indicatorDotActive]} />
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const colors = {
  background: "#020617",
  textPrimary: "#F8FAFC",
  textSecondary: "rgba(226, 232, 240, 0.84)",
  textMuted: "rgba(148, 163, 184, 0.96)",
  accent: "#2563EB",
  accentPressed: "#1D4ED8",
} as const;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  background: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundImage: {
    resizeMode: "cover",
    transform: [{ translateX: 14 }],
  },
  baseTone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(1, 5, 12, 0.25)",
  },
  leftReadabilityShade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "64%",
    backgroundColor: "rgba(1, 5, 12, 0.48)",
  },
  topShade: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    height: "36%",
    backgroundColor: "rgba(1, 5, 12, 0.18)",
  },
  bottomShade: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: "34%",
    backgroundColor: "rgba(1, 5, 12, 0.34)",
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 22,
  },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    justifyContent: "space-between",
    gap: 34,
  },
  heroSection: {
    gap: 30,
  },
  brand: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  headlineBlock: {
    gap: 14,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  headlineAccent: {
    color: colors.accent,
  },
  supportingCopy: {
    maxWidth: 292,
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 25,
  },
  benefitList: {
    gap: 18,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
  },
  benefitIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.34)",
    backgroundColor: "rgba(2, 6, 23, 0.48)",
    alignItems: "center",
    justifyContent: "center",
  },
  benefitCopy: {
    flex: 1,
    gap: 3,
    paddingTop: 1,
  },
  benefitTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  benefitDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  bottomSection: {
    gap: 14,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryButtonPressed: {
    backgroundColor: colors.accentPressed,
  },
  primaryButtonLabel: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  timeEstimate: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  timeEstimateText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  indicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
  indicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.55)",
  },
  indicatorDotActive: {
    backgroundColor: colors.accent,
  },
});
