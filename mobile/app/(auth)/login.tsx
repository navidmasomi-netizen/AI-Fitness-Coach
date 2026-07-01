import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useRouter, Link } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (err) {
      console.log("login failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 12 }}>
      <Text>Login</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        style={{ borderWidth: 1, width: "100%", padding: 8 }}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, width: "100%", padding: 8 }}
      />
      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
      <Pressable onPress={onSubmit} disabled={submitting} style={{ padding: 12, backgroundColor: "#ddd" }}>
        <Text>{submitting ? "Logging in..." : "Log In"}</Text>
      </Pressable>
      <Link href="/(auth)/register">
        <Text>Go to Register</Text>
      </Link>
    </View>
  );
}
