import { ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RunpuyButton } from '../../src/design-system/components/RunpuyButton';
import { RunpuyText } from '../../src/design-system/components/RunpuyText';
import { useRunpuyTheme } from '../../src/design-system/theme-context';
import { iconography, layout, radii, spacing } from '../../src/design-system/tokens';
import { markIntroSeen } from '../../src/store/onboardingStorage';

const onboardingIntroHero = require('../../assets/images/onboarding/onboarding-intro-hero.png');

const BENEFITS = [
  {
    icon: 'user-check' as const,
    title: 'Personalized for you',
    description: 'Every plan is tailored to your goals,\nbody and experience.',
  },
  {
    icon: 'cpu' as const,
    title: 'Adaptive & smart',
    description: 'Your program evolves based on your\nprogress and feedback.',
  },
  {
    icon: 'calendar' as const,
    title: 'Built around your life',
    description: 'We fit your plan to your schedule,\nequipment and lifestyle.',
  },
];

export default function IntroScreen() {
  const router = useRouter();
  const { scheme, theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const overlayStyle = (darkColor: string, opacity: number) =>
    scheme === 'dark' ? { backgroundColor: darkColor } : { backgroundColor: theme.colors.canvas, opacity };

  const onContinue = async () => {
    await markIntroSeen();
    router.replace('/');
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
        <View pointerEvents="none" style={[styles.baseTone, overlayStyle('rgba(1, 5, 12, 0.25)', 0.25)]} />
        <View pointerEvents="none" style={[styles.leftReadabilityShade, overlayStyle('rgba(1, 5, 12, 0.48)', 0.48)]} />
        <View pointerEvents="none" style={[styles.topShade, overlayStyle('rgba(1, 5, 12, 0.18)', 0.18)]} />
        <View pointerEvents="none" style={[styles.bottomShade, overlayStyle('rgba(1, 5, 12, 0.34)', 0.34)]} />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.heroSection}>
                <RunpuyText variant="caption">
                  AI COACH
                </RunpuyText>

                <View style={styles.headlineBlock}>
                  <RunpuyText accessibilityRole="header" variant="display">
                    Let&apos;s build{'\n'}
                    your{' '}
                    <RunpuyText variant="display" style={styles.headlineAccent}>
                      best plan.
                    </RunpuyText>
                  </RunpuyText>
                  <RunpuyText variant="body" tone="secondary" style={styles.supportingCopy}>
                    Answer a few questions so I can create a program that&apos;s built just for you.
                  </RunpuyText>
                </View>

                <View style={styles.benefitList}>
                  {BENEFITS.map((benefit) => (
                    <View key={benefit.title} style={styles.benefitRow}>
                      <View style={styles.benefitIcon}>
                        <Feather
                          name={benefit.icon}
                          size={iconography.grid}
                          color={theme.colors.actionPrimary}
                        />
                      </View>
                      <View style={styles.benefitCopy}>
                        <RunpuyText variant="title">
                          {benefit.title}
                        </RunpuyText>
                        <RunpuyText variant="caption" tone="secondary">
                          {benefit.description}
                        </RunpuyText>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.bottomSection}>
                <RunpuyButton
                  label="Get Started"
                  accessibilityLabel="Get started with onboarding"
                  onPress={onContinue}
                />

                <View style={styles.timeEstimate}>
                  <Feather name="clock" size={spacing.lg} color={theme.colors.textSecondary} />
                  <RunpuyText variant="caption" tone="secondary">
                    Takes about 2–3 minutes
                  </RunpuyText>
                </View>

                <View
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel="Onboarding step 1 of 4"
                  style={styles.indicator}
                >
                  {[0, 1, 2, 3].map((position) => (
                    <View
                      key={position}
                      style={[
                        styles.indicatorDot,
                        position === 0 && styles.indicatorDotActive,
                      ]}
                    />
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

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>['theme']) => StyleSheet.create({
  root: {
    backgroundColor: theme.colors.canvas,
    flex: 1,
  },
  background: {
    backgroundColor: theme.colors.canvas,
    flex: 1,
  },
  backgroundImage: {
    resizeMode: 'cover',
    transform: [{ translateX: 14 }],
  },
  // Existing image-readability overlays remain local structural composition values.
  baseTone: {
    ...StyleSheet.absoluteFillObject,
  },
  leftReadabilityShade: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: '64%',
  },
  topShade: {
    height: '36%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  bottomShade: {
    bottom: 0,
    height: '34%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.lg,
    paddingHorizontal: layout.pageMargin,
    paddingTop: spacing.lg,
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    gap: spacing['2xl'],
    justifyContent: 'space-between',
    maxWidth: 440,
    width: '100%',
  },
  heroSection: {
    gap: spacing['2xl'],
  },
  headlineBlock: {
    gap: spacing.md,
  },
  headlineAccent: {
    color: theme.colors.actionPrimary,
  },
  supportingCopy: {
    maxWidth: 292,
  },
  benefitList: {
    gap: spacing.lg,
  },
  benefitRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  benefitIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.borderSubtle,
    borderRadius: radii.control,
    borderWidth: 1,
    height: layout.minimumTouchTarget,
    justifyContent: 'center',
    width: layout.minimumTouchTarget,
  },
  benefitCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  bottomSection: {
    gap: spacing.md,
  },
  timeEstimate: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  indicator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  indicatorDot: {
    backgroundColor: theme.colors.borderSubtle,
    borderRadius: radii.control,
    height: spacing.xs,
    width: spacing.xs,
  },
  indicatorDotActive: {
    backgroundColor: theme.colors.actionPrimary,
    width: spacing.lg,
  },
});
