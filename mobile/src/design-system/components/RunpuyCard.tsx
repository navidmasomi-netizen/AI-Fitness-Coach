import type { ComponentProps, ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useRunpuyTheme } from '../theme-context';
import type { RunpuyTheme } from '../themes';
import { radii, spacing } from '../tokens';

export type RunpuyCardProps = Omit<ComponentProps<typeof View>, 'children' | 'style'> & {
  children: ReactNode;
  theme?: RunpuyTheme;
  style?: StyleProp<ViewStyle>;
};

export function RunpuyCard({ children, theme: themeOverride, style, ...viewProps }: RunpuyCardProps) {
  const { theme: contextTheme } = useRunpuyTheme();
  const theme = themeOverride ?? contextTheme;

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
