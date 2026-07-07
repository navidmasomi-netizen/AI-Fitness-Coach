import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const MEAL_FREQUENCY_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function WizardStepThirteenScreen() {
  const router = useRouter();
  const mealFrequency = useWizardDraftStore((s) => s.mealFrequency);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const setMealFrequency = useWizardDraftStore((s) => s.setMealFrequency);
  const totalSteps = getWizardTotalSteps(supplementUse);

  return (
    <WizardStepScreen
      currentStep={13}
      totalSteps={totalSteps}
      title="How many meals do you usually eat per day?"
      canGoBack
      isNextEnabled={mealFrequency !== null}
      onNext={() => router.push("/(profile)/wizard/step-14")}
    >
      <View style={{ gap: 10 }}>
        {MEAL_FREQUENCY_OPTIONS.map((option) => {
          const isSelected = mealFrequency === option;
          return (
            <Pressable
              key={option}
              onPress={() => setMealFrequency(option)}
              style={{
                padding: 16,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isSelected ? "#2196f3" : "#ddd",
                backgroundColor: isSelected ? "#e3f2fd" : "#fff",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>
                {option} meal{option > 1 ? "s" : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </WizardStepScreen>
  );
}
