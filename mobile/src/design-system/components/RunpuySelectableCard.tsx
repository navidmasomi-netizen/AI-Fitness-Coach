import { useState, type ComponentProps, type ReactNode } from 'react';
import { I18nManager, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useRunpuyTheme } from '../theme-context';
import type { RunpuyTextScript } from '../fonts';
import type { RunpuyTheme } from '../themes';
import { iconography, layout, radii, spacing } from '../tokens';
import { RunpuyText } from './RunpuyText';

export type RunpuySelectableCardSelectionRole = 'radio' | 'checkbox';

export type RunpuySelectableCardProps = Omit<
  ComponentProps<typeof Pressable>,
  'accessibilityRole' | 'children' | 'disabled' | 'onPress' | 'style'
> & {
  label: string;
  script?: RunpuyTextScript;
  description?: string;
  icon?: ReactNode;
  selected: boolean;
  selectionRole: RunpuySelectableCardSelectionRole;
  onPress: NonNullable<ComponentProps<typeof Pressable>['onPress']>;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  theme?: RunpuyTheme;
  style?: StyleProp<ViewStyle>;
};

export function RunpuySelectableCard({
  label,
  script = 'latin',
  description,
  icon,
  selected,
  selectionRole,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  theme: themeOverride,
  style,
  onFocus,
  onBlur,
  ...pressableProps
}: RunpuySelectableCardProps) {
  const { theme: contextTheme } = useRunpuyTheme();
  const theme = themeOverride ?? contextTheme;
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole={selectionRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        ...accessibilityState,
        checked: selected,
        disabled,
      }}
      disabled={disabled}
      onPress={onPress}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        style,
        {
          alignItems: 'center',
          backgroundColor: theme.colors.card,
          borderColor: focused
            ? theme.colors.focus
            : selected
              ? theme.colors.actionPrimary
              : theme.colors.borderSubtle,
          // Border widths are structural focus geometry, not brand tokens.
          borderWidth: focused ? 2 : 1,
          borderRadius: radii.card,
          flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
          gap: spacing.md,
          minHeight: layout.minimumTouchTarget,
          padding: spacing.lg,
        },
      ]}
    >
      {icon ? <View accessible={false}>{icon}</View> : null}
      <View style={styles.copy}>
        <RunpuyText script={script} theme={theme} variant="title">
          {label}
        </RunpuyText>
        {description ? (
          <RunpuyText theme={theme} variant="caption" tone="secondary">
            {description}
          </RunpuyText>
        ) : null}
      </View>
      <View
        accessible={false}
        style={[
          styles.indicator,
          {
            borderColor: selected ? theme.colors.actionPrimary : theme.colors.borderSubtle,
            borderRadius: selectionRole === 'radio' ? iconography.grid / 2 : radii.control,
          },
        ]}
      >
        {selected && selectionRole === 'radio' ? (
          <View style={[styles.radioMark, { backgroundColor: theme.colors.actionPrimary }]} />
        ) : null}
        {selected && selectionRole === 'checkbox' ? (
          <View style={[styles.checkboxMark, { borderColor: theme.colors.actionPrimary }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = {
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  // Indicator dimensions use the canonical icon grid and spacing tokens.
  indicator: {
    alignItems: 'center',
    borderWidth: 1,
    height: iconography.grid,
    justifyContent: 'center',
    width: iconography.grid,
  },
  radioMark: {
    borderRadius: spacing.xs,
    height: spacing.sm,
    width: spacing.sm,
  },
  // The check stroke is structural icon geometry using the canonical icon stroke.
  checkboxMark: {
    borderBottomWidth: iconography.stroke,
    borderRightWidth: iconography.stroke,
    height: spacing.xs,
    transform: [{ rotate: '45deg' }],
    width: spacing.sm,
  },
} satisfies Record<string, ViewStyle>;
