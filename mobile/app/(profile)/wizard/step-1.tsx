import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { GOAL_LABELS, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const GOAL_OPTIONS = ["hypertrophy", "strength", "fat_loss", "recomposition"];

export default function WizardStepOneScreen() {
  const router = useRouter();
  const goal = useWizardDraftStore((s) => s.goal);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const setGoal = useWizardDraftStore((s) => s.setGoal);
  const totalSteps = getWizardTotalSteps(supplementUse);

  return (
    <WizardStepScreen
      currentStep={1}
      totalSteps={totalSteps}
      title="What is your primary goal?"
      canGoBack={false}
      isNextEnabled={goal !== null}
      onNext={() => router.push("/(profile)/wizard/step-2")}
    >
      <View style={{ gap: 10 }}>
        {GOAL_OPTIONS.map((option) => {
          const isSelected = goal === option;
          return (
            <Pressable
              key={option}
              onPress={() => setGoal(option)}
              style={{
                padding: 16,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isSelected ? "#2196f3" : "#ddd",
                backgroundColor: isSelected ? "#e3f2fd" : "#fff",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>{GOAL_LABELS[option]}</Text>
            </Pressable>
          );
        })}
      </View>
    </WizardStepScreen>
  );
}
