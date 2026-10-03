import type { ComponentProps, ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { lightTheme, type RunpuyTheme } from '../themes';
import { radii, spacing } from '../tokens';

export type RunpuyCardProps = Omit<ComponentProps<typeof View>, 'children' | 'style'> & {
  children: ReactNode;
  theme?: RunpuyTheme;
  style?: StyleProp<ViewStyle>;
};

export function RunpuyCard({ children, theme = lightTheme, style, ...viewProps }: RunpuyCardProps) {
  return (
    <View
      {...viewProps}
      style={[
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.borderSubtle,
          borderRadius: radii.card,
          borderWidth: 1,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
