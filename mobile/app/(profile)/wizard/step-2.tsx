import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { TRAINING_LEVEL_LABELS, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const TRAINING_LEVEL_OPTIONS = ["beginner", "intermediate", "advanced"];

export default function WizardStepTwoScreen() {
  const router = useRouter();
  const trainingLevel = useWizardDraftStore((s) => s.trainingLevel);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const setTrainingLevel = useWizardDraftStore((s) => s.setTrainingLevel);
  const totalSteps = getWizardTotalSteps(supplementUse);

  return (
    <WizardStepScreen
      currentStep={2}
      totalSteps={totalSteps}
      title="What is your training level?"
      canGoBack
      isNextEnabled={trainingLevel !== null}
      onNext={() => router.push("/(profile)/wizard/step-3")}
    >
      <View style={{ gap: 10 }}>
        {TRAINING_LEVEL_OPTIONS.map((option) => {
          const isSelected = trainingLevel === option;
          return (
            <Pressable
              key={option}
              onPress={() => setTrainingLevel(option)}
              style={{
                padding: 16,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isSelected ? "#2196f3" : "#ddd",
                backgroundColor: isSelected ? "#e3f2fd" : "#fff",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>{TRAINING_LEVEL_LABELS[option]}</Text>
            </Pressable>
          );
        })}
      </View>
    </WizardStepScreen>
  );
}
