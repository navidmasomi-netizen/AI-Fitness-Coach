import { ReactNode } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { authTheme } from "./authTheme";

const authHeroImage = require("../../../assets/images/auth/auth-hero.png");

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
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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
    flex: 1,
    backgroundColor: authTheme.colors.background,
  },
  background: {
    flex: 1,
    backgroundColor: authTheme.colors.background,
  },
  backgroundImage: {
    resizeMode: "cover",
  },
  baseTone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(1, 5, 12, 0.32)",
  },
  leftReadabilityShade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "78%",
    backgroundColor: "rgba(1, 5, 12, 0.42)",
  },
  bottomShade: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: "38%",
    backgroundColor: "rgba(1, 5, 12, 0.36)",
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
    justifyContent: "center",
    paddingHorizontal: authTheme.spacing.screenHorizontal,
    paddingTop: authTheme.spacing.screenTop,
    paddingBottom: authTheme.spacing.screenBottom,
  },
  content: {
    width: "100%",
    maxWidth: authTheme.sizes.contentMaxWidth,
    alignSelf: "center",
  },
});
