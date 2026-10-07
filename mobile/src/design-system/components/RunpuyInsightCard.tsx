import type { ComponentProps } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useRunpuyTheme } from '../theme-context';
import type { RunpuyTheme } from '../themes';
import { radii, spacing } from '../tokens';
import { RunpuyText } from './RunpuyText';

export type RunpuyInsightCardProps = Omit<ComponentProps<typeof View>, 'children' | 'style'> & {
  finding: string;
  evidence: string;
  recommendedNextStep: string;
  theme?: RunpuyTheme;
  style?: StyleProp<ViewStyle>;
};

export function RunpuyInsightCard({
  finding,
  evidence,
  recommendedNextStep,
  theme: themeOverride,
  style,
  ...viewProps
}: RunpuyInsightCardProps) {
  const { theme: contextTheme } = useRunpuyTheme();
  const theme = themeOverride ?? contextTheme;

  return (
    <View
      {...viewProps}
      style={[
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.borderSubtle,
          borderRadius: radii.insight,
          borderWidth: 1,
          gap: spacing.sm,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      <RunpuyText theme={theme} variant="title">
        {finding}
      </RunpuyText>
      <RunpuyText theme={theme} tone="secondary" variant="body">
        {evidence}
      </RunpuyText>
      <RunpuyText theme={theme} variant="caption">
        {recommendedNextStep}
      </RunpuyText>
    </View>
  );
}
