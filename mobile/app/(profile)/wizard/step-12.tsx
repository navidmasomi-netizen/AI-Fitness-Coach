import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const NUTRITION_HABITS_OPTIONS = ["strict", "moderate", "flexible", "unstructured"];

export default function WizardStepTwelveScreen() {
  const router = useRouter();
  const nutritionHabits = useWizardDraftStore((s) => s.nutritionHabits);
  const setNutritionHabits = useWizardDraftStore((s) => s.setNutritionHabits);

  return (
    <WizardStepScreen
      currentStep={12}
      totalSteps={18}
      title="How would you describe your nutrition habits?"
      canGoBack
      isNextEnabled={nutritionHabits !== null}
      onNext={() => router.push("/(profile)/wizard/step-13")}
    >
      <View style={{ gap: 10 }}>
        {NUTRITION_HABITS_OPTIONS.map((option) => {
          const isSelected = nutritionHabits === option;
          return (
            <Pressable
              key={option}
              onPress={() => setNutritionHabits(option)}
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
