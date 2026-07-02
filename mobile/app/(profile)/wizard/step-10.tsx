import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const OCCUPATION_TYPE_OPTIONS = ["desk_job", "active_job", "mixed", "student", "unemployed"];

export default function WizardStepTenScreen() {
  const router = useRouter();
  const occupationType = useWizardDraftStore((s) => s.occupationType);
  const setOccupationType = useWizardDraftStore((s) => s.setOccupationType);

  return (
    <WizardStepScreen
      currentStep={10}
      totalSteps={11}
      title="What best describes your occupation?"
      canGoBack
      isNextEnabled={occupationType !== null}
      onNext={() => router.push("/(profile)/wizard/step-11")}
    >
      <View style={{ gap: 10 }}>
        {OCCUPATION_TYPE_OPTIONS.map((option) => {
          const isSelected = occupationType === option;
          return (
            <Pressable
              key={option}
              onPress={() => setOccupationType(option)}
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
