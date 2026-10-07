import { ReactNode } from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  TextInput,
  TextInputFocusEventData,
  TextInputProps,
  View,
} from 'react-native';

import { RunpuyText } from '../../design-system/components/RunpuyText';
import { runpuyFontFamilies } from '../../design-system/fonts';
import { useRunpuyTheme } from '../../design-system/theme-context';
import { layout, radii, spacing } from '../../design-system/tokens';
import { typography } from '../../design-system/typography';

type AuthTextFieldProps = TextInputProps & {
  label: string;
  icon?: ReactNode;
  error?: string | null;
  helperText?: string | null;
  rightAccessory?: ReactNode;
  isFocused?: boolean;
  onFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onBlur?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
};

export function AuthTextField({
  label,
  icon,
  error = null,
  helperText = null,
  rightAccessory,
  isFocused = false,
  onFocus,
  onBlur,
  ...inputProps
}: AuthTextFieldProps) {
  const { theme } = useRunpuyTheme();
  const borderColor = error
    ? theme.colors.error
    : isFocused
      ? theme.colors.focus
      : theme.colors.borderSubtle;

  return (
    <View style={styles.root}>
      <RunpuyText variant="caption">
        {label}
      </RunpuyText>
      <View style={[styles.fieldShell, { backgroundColor: theme.colors.card, borderColor }]}>
        {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
        <TextInput
          placeholderTextColor={theme.colors.textSecondary}
          selectionColor={theme.colors.textPrimary}
          style={[styles.input, { color: theme.colors.textPrimary }]}
          onFocus={onFocus}
          onBlur={onBlur}
          accessibilityLabel={label}
          {...inputProps}
        />
        {rightAccessory ? <View style={styles.rightAccessory}>{rightAccessory}</View> : null}
      </View>
      {error ? (
        <RunpuyText variant="caption" style={{ color: theme.colors.error }}>
          {error}
        </RunpuyText>
      ) : null}
      {!error && helperText ? (
        <RunpuyText variant="caption" tone="secondary">
          {helperText}
        </RunpuyText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  fieldShell: {
    alignItems: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
  iconSlot: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: runpuyFontFamilies.latin.body,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    paddingVertical: spacing.md,
  },
  rightAccessory: {
    marginLeft: spacing.sm,
  },
});
