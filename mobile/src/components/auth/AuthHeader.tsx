import { Image, StyleProp, StyleSheet, TextStyle, View } from 'react-native';

import { RunpuyText } from '../../design-system/components/RunpuyText';
import { colorPrimitives, spacing } from '../../design-system/tokens';

const runpuyLogo = require('../../../assets/brand/logo-horizontal-reverse.png');

type AuthHeaderProps = {
  title: string;
  subtitle: string;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

export function AuthHeader({ title, subtitle, titleStyle, subtitleStyle }: AuthHeaderProps) {
  return (
    <View style={styles.root}>
      <Image
        accessible
        accessibilityLabel="RUNPUY"
        resizeMode="contain"
        source={runpuyLogo}
        style={styles.brandLogo}
      />

      <View style={styles.heroCopy}>
        <RunpuyText
          accessibilityRole="header"
          variant="heading"
          style={[styles.title, titleStyle]}
        >
          {title}
        </RunpuyText>
        <RunpuyText variant="body" style={[styles.subtitle, subtitleStyle]}>
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
  brandLogo: {
    height: 24,
    width: 132,
  },
  heroCopy: {
    gap: spacing.sm,
  },
  title: {
    color: colorPrimitives.warmWhite,
  },
  subtitle: {
    color: colorPrimitives.warmWhite,
  },
});
