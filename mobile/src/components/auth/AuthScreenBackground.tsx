import { ReactNode } from 'react';
import {
  ImageBackground,
  ImageStyle,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRunpuyTheme } from '../../design-system/theme-context';
import { layout, spacing } from '../../design-system/tokens';

const authHeroImage = require('../../../assets/images/auth/auth-hero.png');

type AuthScreenBackgroundProps = {
  children: ReactNode;
  backgroundImageSource?: ImageSourcePropType | null;
  backgroundImageStyle?: StyleProp<ImageStyle>;
};

export function AuthScreenBackground({
  children,
  backgroundImageSource = authHeroImage,
  backgroundImageStyle,
}: AuthScreenBackgroundProps) {
  const { scheme, theme } = useRunpuyTheme();
  const overlayStyle = (darkColor: string, opacity: number): ViewStyle =>
    scheme === 'dark'
      ? { backgroundColor: darkColor }
      : { backgroundColor: theme.colors.canvas, opacity };

  const content = (
    <>
      <View style={[styles.baseTone, overlayStyle('rgba(1, 5, 12, 0.32)', 0.32)]} />
      <View style={[styles.leftReadabilityShade, overlayStyle('rgba(1, 5, 12, 0.42)', 0.42)]} />
      <View style={[styles.bottomShade, overlayStyle('rgba(1, 5, 12, 0.36)', 0.36)]} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {backgroundImageSource ? (
        <ImageBackground
          source={backgroundImageSource}
          resizeMode="cover"
          style={[styles.background, { backgroundColor: theme.colors.canvas }]}
          imageStyle={[styles.backgroundImage, backgroundImageStyle]}
        >
          {content}
        </ImageBackground>
      ) : (
        <View style={[styles.background, { backgroundColor: theme.colors.canvas }]}>{content}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  backgroundImage: {
    resizeMode: 'cover',
  },
  baseTone: {
    ...StyleSheet.absoluteFillObject,
  },
  leftReadabilityShade: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: '78%',
  },
  bottomShade: {
    bottom: 0,
    height: '38%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  safeArea: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: layout.pageMargin,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  content: {
    alignSelf: 'center',
    maxWidth: 440,
    width: '100%',
  },
});
