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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { darkTheme } from '../../design-system/themes';
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
  const content = (
    <>
      <View style={styles.baseTone} />
      <View style={styles.leftReadabilityShade} />
      <View style={styles.bottomShade} />
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
    <View style={styles.root}>
      {backgroundImageSource ? (
        <ImageBackground
          source={backgroundImageSource}
          resizeMode="cover"
          style={styles.background}
          imageStyle={[styles.backgroundImage, backgroundImageStyle]}
        >
          {content}
        </ImageBackground>
      ) : (
        <View style={styles.background}>{content}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: darkTheme.colors.canvas,
    flex: 1,
  },
  background: {
    backgroundColor: darkTheme.colors.canvas,
    flex: 1,
  },
  backgroundImage: {
    resizeMode: 'cover',
  },
  // Existing image-readability overlays are local structural composition values.
  baseTone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 5, 12, 0.32)',
  },
  leftReadabilityShade: {
    backgroundColor: 'rgba(1, 5, 12, 0.42)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: '78%',
  },
  bottomShade: {
    backgroundColor: 'rgba(1, 5, 12, 0.36)',
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
