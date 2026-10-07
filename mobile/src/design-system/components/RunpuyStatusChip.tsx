import type { ComponentProps, ReactNode } from 'react';
import { I18nManager, View, type StyleProp, type ViewStyle } from 'react-native';

import { useRunpuyTheme } from '../theme-context';
import type { RunpuyTheme } from '../themes';
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
  theme: themeOverride,
  style,
  ...viewProps
}: RunpuyStatusChipProps) {
  const { theme: contextTheme } = useRunpuyTheme();
  const theme = themeOverride ?? contextTheme;
  const color = statusColor(status, theme);

  return (
    <View
      {...viewProps}
      accessibilityRole="text"
      style={[
        {
          alignItems: 'center',
          alignSelf: I18nManager.isRTL ? 'flex-end' : 'flex-start',
          backgroundColor: theme.colors.card,
          borderColor: status === 'neutral' ? theme.colors.borderSubtle : color,
          borderRadius: radii.control,
          borderWidth: 1,
          flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
        style,
      ]}
    >
      {icon}
      <RunpuyText theme={theme} variant="caption" style={{ color: theme.colors.textPrimary }}>
        {label}
      </RunpuyText>
    </View>
  );
}
