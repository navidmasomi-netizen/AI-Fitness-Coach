import { StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";

import { authTheme } from "./authTheme";

type AuthHeaderProps = {
  title: string;
  subtitle: string;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

export function AuthHeader({ title, subtitle, titleStyle, subtitleStyle }: AuthHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandLetter}>A</Text>
        </View>
        <View style={styles.brandText}>
          <Text style={styles.brandName}>AI COACH</Text>
          <Text style={styles.brandTagline}>YOUR TRAINING PARTNER</Text>
        </View>
      </View>

      <View style={styles.heroCopy}>
        <Text accessibilityRole="header" style={[styles.title, titleStyle]}>
          {title}
        </Text>
        <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 22,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  brandMark: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLetter: {
    color: authTheme.colors.accent,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 28,
  },
  brandText: {
    gap: 1,
  },
  brandName: {
    color: authTheme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.3,
    lineHeight: 26,
  },
  brandTagline: {
    color: authTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
    lineHeight: 12,
  },
  heroCopy: {
    gap: 8,
  },
  title: {
    color: authTheme.colors.textPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
  },
  subtitle: {
    color: authTheme.colors.textSecondary,
    fontSize: 17,
    lineHeight: 24,
  },
});
