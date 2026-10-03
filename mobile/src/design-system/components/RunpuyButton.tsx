import { useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { lightTheme, type RunpuyTheme } from '../themes';
import { layout, radii, spacing } from '../tokens';
import { RunpuyText } from './RunpuyText';

export type RunpuyButtonProps = Omit<
  ComponentProps<typeof Pressable>,
  'accessibilityRole' | 'children' | 'disabled' | 'onPress' | 'style'
> & {
  label: string;
  onPress: NonNullable<ComponentProps<typeof Pressable>['onPress']>;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  theme?: RunpuyTheme;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function RunpuyButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityState,
  theme = lightTheme,
  style,
  textStyle,
  onFocus,
  onBlur,
  ...pressableProps
}: RunpuyButtonProps) {
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || loading;

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{
        ...accessibilityState,
        disabled: unavailable,
        busy: loading || accessibilityState?.busy,
      }}
      disabled={unavailable}
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
        {
          alignItems: 'center',
          backgroundColor: theme.colors.actionPrimary,
          borderColor: focused ? theme.colors.focus : theme.colors.actionPrimary,
          borderRadius: radii.button,
          borderWidth: focused ? 2 : 0,
          justifyContent: 'center',
          minHeight: layout.minimumTouchTarget,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.actionPrimaryText} />
      ) : (
        <RunpuyText
          theme={theme}
          variant="body"
          style={[{ color: theme.colors.actionPrimaryText }, textStyle]}
        >
          {label}
        </RunpuyText>
      )}
    </Pressable>
  );
}
