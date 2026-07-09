import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const TRAINING_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export default function WizardStepThreeScreen() {
  const router = useRouter();
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const trainingDaysPerWeek = useWizardDraftStore((s) => s.trainingDaysPerWeek);
  const setTrainingDaysPerWeek = useWizardDraftStore((s) => s.setTrainingDaysPerWeek);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();

  return (
    <WizardStepScreen
      currentStep={3}
      totalSteps={totalSteps}
      title="How many days per week do you train?"
      canGoBack
      isNextEnabled={trainingDaysPerWeek !== null}
      isNextLoading={isSaving}
      errorMessage={errorMessage}
      onNext={async () => {
        if (trainingDaysPerWeek === null) return;
        const didSave = await saveStep({ trainingDaysPerWeek }, 3);
        if (didSave) {
          router.push("/(profile)/wizard/step-4");
        }
      }}
    >
      <View style={{ gap: 10 }}>
        {TRAINING_DAY_OPTIONS.map((option) => {
          const isSelected = trainingDaysPerWeek === option;
          return (
            <Pressable
              key={option}
              onPress={() => setTrainingDaysPerWeek(option)}
              style={{
                padding: 16,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isSelected ? "#2196f3" : "#ddd",
                backgroundColor: isSelected ? "#e3f2fd" : "#fff",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>
                {option} day{option > 1 ? "s" : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </WizardStepScreen>
  );
}
