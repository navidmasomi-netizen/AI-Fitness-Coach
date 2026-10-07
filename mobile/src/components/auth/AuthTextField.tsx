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
import { darkTheme } from '../../design-system/themes';
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
  const borderColor = error
    ? darkTheme.colors.error
    : isFocused
      ? darkTheme.colors.focus
      : darkTheme.colors.borderSubtle;

  return (
    <View style={styles.root}>
      <RunpuyText theme={darkTheme} variant="caption">
        {label}
      </RunpuyText>
      <View style={[styles.fieldShell, { borderColor }]}>
        {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
        <TextInput
          placeholderTextColor={darkTheme.colors.textSecondary}
          selectionColor={darkTheme.colors.textPrimary}
          style={styles.input}
          onFocus={onFocus}
          onBlur={onBlur}
          accessibilityLabel={label}
          {...inputProps}
        />
        {rightAccessory ? <View style={styles.rightAccessory}>{rightAccessory}</View> : null}
      </View>
      {error ? (
        <RunpuyText theme={darkTheme} variant="caption" style={styles.errorText}>
          {error}
        </RunpuyText>
      ) : null}
      {!error && helperText ? (
        <RunpuyText theme={darkTheme} variant="caption" tone="secondary">
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
    backgroundColor: darkTheme.colors.card,
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
    color: darkTheme.colors.textPrimary,
    flex: 1,
    fontFamily: runpuyFontFamilies.latin.body,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    paddingVertical: spacing.md,
  },
  rightAccessory: {
    marginLeft: spacing.sm,
  },
  errorText: {
    color: darkTheme.colors.error,
  },
});
