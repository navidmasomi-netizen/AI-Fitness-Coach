import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { authTheme } from "./authTheme";

type AuthPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function AuthPrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: AuthPrimaryButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        inactive && styles.buttonDisabled,
        pressed && !inactive && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={authTheme.colors.textPrimary} />
      ) : (
        <Text style={[styles.label, inactive && styles.labelDisabled]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: authTheme.sizes.buttonHeight,
    borderRadius: authTheme.radius.button,
    backgroundColor: authTheme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    backgroundColor: authTheme.colors.accentPressed,
  },
  buttonDisabled: {
    backgroundColor: authTheme.colors.disabled,
  },
  label: {
    color: authTheme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  labelDisabled: {
    color: authTheme.colors.disabledText,
  },
});
