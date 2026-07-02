import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const CARDIO_PREFERENCE_OPTIONS = ["none", "low_intensity", "hiit", "mixed"];

export default function WizardStepFourteenScreen() {
  const router = useRouter();
  const cardioPreference = useWizardDraftStore((s) => s.cardioPreference);
  const setCardioPreference = useWizardDraftStore((s) => s.setCardioPreference);

  return (
    <WizardStepScreen
      currentStep={14}
      totalSteps={18}
      title="What is your cardio preference?"
      canGoBack
      isNextEnabled={cardioPreference !== null}
      onNext={() => router.push("/(profile)/wizard/step-15")}
    >
      <View style={{ gap: 10 }}>
        {CARDIO_PREFERENCE_OPTIONS.map((option) => {
          const isSelected = cardioPreference === option;
          return (
            <Pressable
              key={option}
              onPress={() => setCardioPreference(option)}
              style={{
                padding: 16,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isSelected ? "#2196f3" : "#ddd",
                backgroundColor: isSelected ? "#e3f2fd" : "#fff",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </WizardStepScreen>
  );
}
