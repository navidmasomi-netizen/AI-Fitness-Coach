import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { AuthHeader } from "../../src/components/auth/AuthHeader";
import { AuthPasswordField } from "../../src/components/auth/AuthPasswordField";
import { AuthPrimaryButton } from "../../src/components/auth/AuthPrimaryButton";
import { AuthScreenBackground } from "../../src/components/auth/AuthScreenBackground";
import { AuthTextField } from "../../src/components/auth/AuthTextField";
import { authTheme } from "../../src/components/auth/authTheme";
import { useAuthStore } from "../../src/store/authStore";
import { validateEmail, validateName, validatePassword } from "../../src/utils/registerValidation";

const registerHeroImage = require("../../assets/images/auth/auth-register-hero.png");

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const error = useAuthStore((s) => s.error);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const nameError = hasSubmitted ? validateName(name) : null;
  const emailError = hasSubmitted ? validateEmail(email) : null;
  const passwordError = hasSubmitted ? validatePassword(password) : null;
  const canSubmit = useMemo(
    () => !validateName(name) && !validateEmail(email) && !validatePassword(password),
    [email, name, password]
  );

  const onSubmit = async () => {
    setHasSubmitted(true);
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      await register({ email, name: name.trim(), password });
      router.replace("/");
    } catch (err) {
      // Store-managed auth error is rendered below.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreenBackground
      backgroundImageSource={registerHeroImage}
      backgroundImageStyle={styles.registerBackgroundImage}
    >
      <View style={styles.container}>
        <AuthHeader
          title="Create your account"
          subtitle="Your personalized training starts here."
          titleStyle={styles.registerTitle}
          subtitleStyle={styles.registerSubtitle}
        />

        <View style={styles.form}>
          <View style={styles.formFields}>
            <AuthTextField
              label="Full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              autoComplete="name"
              returnKeyType="next"
              placeholder="Full name"
              error={nameError}
              isFocused={nameFocused}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              icon={<Feather name="user" size={18} color={authTheme.colors.icon} />}
            />

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
            <View style={styles.legalRow} accessible accessibilityRole="text">
              <View style={styles.legalCheckbox} />
              <Text style={styles.legalText}>
                I agree to the <Text style={styles.legalLink}>Terms of Service</Text>{"\n"}
                and <Text style={styles.legalLink}>Privacy Policy</Text>
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text accessibilityRole="alert" style={styles.serverError}>
              {error}
            </Text>
          ) : null}

          <AuthPrimaryButton
            label="Create Account"
            onPress={onSubmit}
            loading={submitting}
            disabled={!canSubmit}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to login"
              hitSlop={8}
              onPress={() => router.push("/(auth)/login")}
            >
              <Text style={styles.footerLink}>Log in</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </AuthScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: authTheme.spacing.sectionGap,
  },
  registerBackgroundImage: {
    transform: [{ scale: 1.035 }, { translateX: 10 }, { translateY: -11 }],
  },
  registerTitle: {
    fontSize: 31,
    lineHeight: 37,
  },
  registerSubtitle: {
    maxWidth: 245,
  },
  form: {
    gap: 16,
  },
  formFields: {
    gap: authTheme.spacing.fieldGap,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  legalCheckbox: {
    width: 26,
    height: 26,
    marginTop: 1,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: authTheme.colors.panelBorder,
    backgroundColor: "rgba(5, 12, 22, 0.60)",
  },
  legalText: {
    flex: 1,
    color: authTheme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
  },
  legalLink: {
    color: authTheme.colors.accent,
  },
  serverError: {
    color: authTheme.colors.error,
    fontSize: 14,
    lineHeight: 20,
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
    fontWeight: "700",
  },
});
