import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useRunpuyTheme } from '../../design-system/theme-context';
import { layout } from '../../design-system/tokens';
import { AuthTextField } from './AuthTextField';

type AuthPasswordFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  helperText?: string | null;
};

export function AuthPasswordField({
  value,
  onChangeText,
  error = null,
  helperText = null,
}: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { theme } = useRunpuyTheme();

  return (
    <AuthTextField
      label="Password"
      value={value}
      onChangeText={onChangeText}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      secureTextEntry={!visible}
      error={error}
      helperText={helperText}
      isFocused={isFocused}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      icon={<Feather name="lock" size={18} color={theme.colors.textSecondary} />}
      rightAccessory={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          accessibilityHint="Toggles password visibility"
          hitSlop={8}
          onPress={() => setVisible((current) => !current)}
          style={styles.visibilityButton}
        >
          <Feather
            name={visible ? 'eye-off' : 'eye'}
            size={18}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  visibilityButton: {
    alignItems: 'center',
    height: layout.minimumTouchTarget,
    justifyContent: 'center',
    width: layout.minimumTouchTarget,
  },
});
