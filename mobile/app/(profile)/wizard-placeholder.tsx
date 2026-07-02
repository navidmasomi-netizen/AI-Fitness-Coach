import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";

export default function WizardPlaceholderScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      {/* Phase 3 temporary placeholder. Replace with the real Fitness Profile Wizard in Phase 4. */}
      <Text style={{ fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 8 }}>
        Fitness Profile Wizard
      </Text>
      <Text style={{ fontSize: 16, color: "#555", textAlign: "center" }}>
        Coming in Phase 4
      </Text>
      <Pressable
        onPress={onLogout}
        style={{ marginTop: 20, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#ddd", borderRadius: 8 }}
      >
        <Text>Logout</Text>
      </Pressable>
    </View>
  );
}
