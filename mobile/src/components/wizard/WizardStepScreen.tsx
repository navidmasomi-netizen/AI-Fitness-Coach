import { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/authStore";

interface WizardStepScreenProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  canGoBack: boolean;
  isNextEnabled: boolean;
  onNext: () => void;
  children: ReactNode;
}

export function WizardStepScreen({
  currentStep,
  totalSteps,
  title,
  canGoBack,
  isNextEnabled,
  onNext,
  children,
}: WizardStepScreenProps) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 60, justifyContent: "space-between" }}>
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <Text style={{ fontSize: 13, color: "#777" }}>
            Step {currentStep} of {totalSteps}
          </Text>
          <Pressable onPress={onLogout} style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
            <Text style={{ color: "#666" }}>Logout</Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>{title}</Text>
        <View>{children}</View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 24 }}>
        {canGoBack ? (
          <Pressable
            onPress={() => router.back()}
            style={{ paddingVertical: 14, paddingHorizontal: 20, backgroundColor: "#ddd", borderRadius: 10 }}
          >
            <Text>Back</Text>
          </Pressable>
        ) : (
          <View style={{ paddingVertical: 14, paddingHorizontal: 20, opacity: 0 }}>
            <Text>Back</Text>
          </View>
        )}

        <Pressable
          onPress={onNext}
          disabled={!isNextEnabled}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 20,
            backgroundColor: isNextEnabled ? "#2196f3" : "#bbdefb",
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>Next</Text>
        </Pressable>
      </View>
    </View>
  );
}
