import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { AuthHeader } from "../../src/components/auth/AuthHeader";
import { AuthPasswordField } from "../../src/components/auth/AuthPasswordField";
import { AuthPrimaryButton } from "../../src/components/auth/AuthPrimaryButton";
import { AuthScreenBackground } from "../../src/components/auth/AuthScreenBackground";
import { AuthTextField } from "../../src/components/auth/AuthTextField";
import { createAuthTheme } from "../../src/components/auth/authTheme";
import { RunpuyText } from "../../src/design-system/components/RunpuyText";
import { useRunpuyTheme } from "../../src/design-system/theme-context";
import { useAuthStore } from "../../src/store/authStore";

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Email is required.";
  }

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (!isValid) {
    return "Enter a valid email address.";
  }

  return null;
}

function validatePassword(value: string): string | null {
  if (!value) {
    return "Password is required.";
  }

  return null;
}

export default function LoginScreen() {
  const router = useRouter();
  const { scheme, theme } = useRunpuyTheme();
  const authTheme = useMemo(() => createAuthTheme(theme), [theme]);
  const styles = useMemo(() => createStyles(authTheme, scheme), [authTheme, scheme]);
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const emailError = hasSubmitted ? validateEmail(email) : null;
  const passwordError = hasSubmitted ? validatePassword(password) : null;

  const canSubmit = useMemo(() => {
    return !validateEmail(email) && !validatePassword(password);
  }, [email, password]);

  const onSubmit = async () => {
    setHasSubmitted(true);
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      // Store-managed auth error is rendered below.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreenBackground>
      <View style={styles.container}>
        <AuthHeader
          title="Welcome Back"
          subtitle="Your next workout is waiting."
        />

        <View style={styles.form}>
          <View style={styles.formFields}>
            <AuthTextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              placeholder="Email address"
              error={emailError}
              isFocused={emailFocused}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              icon={<Feather name="mail" size={18} color={authTheme.colors.icon} />}
            />

            <AuthPasswordField
              value={password}
              onChangeText={setPassword}
              error={passwordError}
            />
          </View>

          {__DEV__ ? (
            <View style={styles.futureActionRow}>
              <RunpuyText variant="caption" style={styles.futureActionText}>Forgot password?</RunpuyText>
            </View>
          ) : null}

          {error ? (
            <RunpuyText accessibilityRole="alert" variant="caption" style={styles.serverError}>
              {error}
            </RunpuyText>
          ) : null}

          <AuthPrimaryButton
            label="Log In"
            onPress={onSubmit}
            loading={submitting}
            disabled={!canSubmit}
          />

          {__DEV__ ? (
            <View style={styles.devOnlySection}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <RunpuyText variant="caption" tone="secondary" style={styles.dividerText}>or continue with</RunpuyText>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <View style={styles.socialButton} accessible accessibilityRole="text">
                  <RunpuyText variant="display" style={styles.socialIcon}>G</RunpuyText>
                  <RunpuyText variant="title" style={styles.socialLabel}>Google</RunpuyText>
                </View>
                <View style={styles.socialButton} accessible accessibilityRole="text">
                  <RunpuyText variant="display" style={styles.socialIcon}></RunpuyText>
                  <RunpuyText variant="title" style={styles.socialLabel}>Apple</RunpuyText>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.footerRow}>
            <RunpuyText variant="body" tone="secondary" style={styles.footerText}>Don&apos;t have an account?</RunpuyText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to register"
              hitSlop={8}
              onPress={() => router.push("/(auth)/register")}
            >
              <RunpuyText variant="display" style={styles.footerLink}>Sign up</RunpuyText>
            </Pressable>
          </View>
        </View>
      </View>
    </AuthScreenBackground>
  );
}

const createStyles = (authTheme: ReturnType<typeof createAuthTheme>, scheme: "light" | "dark") => StyleSheet.create({
  container: {
    gap: authTheme.spacing.sectionGap,
  },
  form: {
    gap: 16,
  },
  formFields: {
    gap: authTheme.spacing.fieldGap,
  },
  futureActionRow: {
    alignItems: "flex-end",
    marginTop: -2,
  },
  futureActionText: {
    color: authTheme.colors.devOnly,
    fontSize: 14,
    fontWeight: "500",
  },
  serverError: {
    color: authTheme.colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  devOnlySection: {
    gap: 16,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: authTheme.colors.subtleDivider,
  },
  dividerText: {
    color: authTheme.colors.textMuted,
    fontSize: 14,
  },
  socialRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: authTheme.radius.input,
    borderWidth: 1,
    borderColor: authTheme.colors.panelBorder,
    backgroundColor: scheme === "dark" ? "rgba(5, 12, 22, 0.60)" : authTheme.colors.panel,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
  },
  socialIcon: {
    color: authTheme.colors.textPrimary,
    fontSize: 19,
  },
  socialLabel: {
    color: authTheme.colors.textPrimary,
    fontSize: 15,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    paddingTop: 6,
  },
  footerText: {
    color: authTheme.colors.textMuted,
    fontSize: 15,
  },
  footerLink: {
    color: authTheme.colors.accent,
    fontSize: 15,
  },
});
