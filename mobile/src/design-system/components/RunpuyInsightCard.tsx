import type { ComponentProps } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { lightTheme, type RunpuyTheme } from '../themes';
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
  theme = lightTheme,
  style,
  ...viewProps
}: RunpuyInsightCardProps) {
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
