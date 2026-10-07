import { StyleProp, StyleSheet, TextStyle, View } from 'react-native';

import { RunpuyText } from '../../design-system/components/RunpuyText';
import { useRunpuyTheme } from '../../design-system/theme-context';
import { spacing } from '../../design-system/tokens';

type AuthHeaderProps = {
  title: string;
  subtitle: string;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

export function AuthHeader({ title, subtitle, titleStyle, subtitleStyle }: AuthHeaderProps) {
  const { theme } = useRunpuyTheme();

  return (
    <View style={styles.root}>
      <View style={styles.brandRow}>
        <RunpuyText variant="heading" style={{ color: theme.colors.actionPrimary }}>
          A
        </RunpuyText>
        <View style={styles.brandText}>
          <RunpuyText variant="title" style={styles.brandName}>
            AI COACH
          </RunpuyText>
          <RunpuyText variant="caption" tone="secondary" style={styles.brandTagline}>
            YOUR TRAINING PARTNER
          </RunpuyText>
        </View>
      </View>

      <View style={styles.heroCopy}>
        <RunpuyText
          accessibilityRole="header"
          variant="heading"
          style={titleStyle}
        >
          {title}
        </RunpuyText>
        <RunpuyText variant="body" tone="secondary" style={subtitleStyle}>
          {subtitle}
        </RunpuyText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xl,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  brandText: {
    gap: spacing.xs,
  },
  brandName: {
    letterSpacing: 0.3,
  },
  brandTagline: {
    letterSpacing: 0.8,
  },
  heroCopy: {
    gap: spacing.sm,
  },
});
