import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../../src/store/authStore";

export default function WizardInfrastructureCompleteScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 60, justifyContent: "space-between" }}>
      <View>
        <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>
          Wizard Infrastructure Complete
        </Text>
        <Text style={{ fontSize: 16, color: "#555" }}>
          Phase 4A placeholder end screen. Real wizard summary and submission come later.
        </Text>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 24 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ paddingVertical: 14, paddingHorizontal: 20, backgroundColor: "#ddd", borderRadius: 10 }}
        >
          <Text>Back</Text>
        </Pressable>

        <Pressable
          onPress={onLogout}
          style={{ paddingVertical: 14, paddingHorizontal: 20, backgroundColor: "#ddd", borderRadius: 10 }}
        >
          <Text>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}
