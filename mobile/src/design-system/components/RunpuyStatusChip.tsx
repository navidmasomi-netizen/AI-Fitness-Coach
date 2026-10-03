import type { ComponentProps, ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { lightTheme, type RunpuyTheme } from '../themes';
import { radii, spacing } from '../tokens';
import { RunpuyText } from './RunpuyText';

export type RunpuyStatus = 'neutral' | 'success' | 'warning' | 'error' | 'information';

export type RunpuyStatusChipProps = Omit<ComponentProps<typeof View>, 'children' | 'style'> & {
  label: string;
  icon?: ReactNode;
  status?: RunpuyStatus;
  theme?: RunpuyTheme;
  style?: StyleProp<ViewStyle>;
};

function statusColor(status: RunpuyStatus, theme: RunpuyTheme) {
  switch (status) {
    case 'success':
      return theme.colors.success;
    case 'warning':
      return theme.colors.warning;
    case 'error':
      return theme.colors.error;
    case 'information':
      return theme.colors.information;
    case 'neutral':
      return theme.colors.textSecondary;
  }
}

export function RunpuyStatusChip({
  label,
  icon,
  status = 'neutral',
  theme = lightTheme,
  style,
  ...viewProps
}: RunpuyStatusChipProps) {
  const color = statusColor(status, theme);

  return (
    <View
      {...viewProps}
      accessibilityRole="text"
      style={[
        {
          alignItems: 'center',
          alignSelf: 'flex-start',
          backgroundColor: theme.colors.card,
          borderColor: status === 'neutral' ? theme.colors.borderSubtle : color,
          borderRadius: radii.control,
          borderWidth: 1,
          flexDirection: 'row',
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
        style,
      ]}
    >
      {icon}
      <RunpuyText theme={theme} variant="caption" style={{ color }}>
        {label}
      </RunpuyText>
    </View>
  );
}
