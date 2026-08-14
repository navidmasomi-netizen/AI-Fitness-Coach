import { ReactNode } from "react";
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputFocusEventData,
  TextInputProps,
  View,
} from "react-native";

import { authTheme } from "./authTheme";

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
    ? authTheme.colors.panelBorderError
    : isFocused
      ? authTheme.colors.panelBorderFocus
      : authTheme.colors.panelBorder;

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.fieldShell, { borderColor }]}>
        {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
        <TextInput
          placeholderTextColor={authTheme.colors.inputPlaceholder}
          selectionColor={authTheme.colors.textPrimary}
          style={styles.input}
          onFocus={onFocus}
          onBlur={onBlur}
          accessibilityLabel={label}
          {...inputProps}
        />
        {rightAccessory ? <View style={styles.rightAccessory}>{rightAccessory}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 7,
  },
  label: {
    color: authTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  fieldShell: {
    minHeight: authTheme.sizes.inputHeight,
    borderRadius: authTheme.radius.input,
    borderWidth: 1,
    backgroundColor: "rgba(5, 12, 22, 0.70)",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 15,
    paddingRight: 12,
  },
  iconSlot: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: authTheme.colors.textPrimary,
    fontSize: 16,
    paddingVertical: 14,
  },
  rightAccessory: {
    marginLeft: 8,
  },
  helperText: {
    color: authTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: authTheme.colors.error,
    fontSize: 13,
    lineHeight: 18,
  },
});
