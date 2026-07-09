import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { CARDIO_PREFERENCE_LABELS, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const CARDIO_PREFERENCE_OPTIONS = ["none", "low_intensity", "hiit", "mixed"];

export default function WizardStepFourteenScreen() {
  const router = useRouter();
  const cardioPreference = useWizardDraftStore((s) => s.cardioPreference);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const setCardioPreference = useWizardDraftStore((s) => s.setCardioPreference);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();

  return (
    <WizardStepScreen
      currentStep={14}
      totalSteps={totalSteps}
      title="What is your cardio preference?"
      canGoBack
      isNextEnabled={cardioPreference !== null}
      isNextLoading={isSaving}
      errorMessage={errorMessage}
      onNext={async () => {
        if (!cardioPreference) return;
        const didSave = await saveStep({ cardioPreference }, 14);
        if (didSave) {
          router.push("/(profile)/wizard/step-15");
        }
      }}
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
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>{CARDIO_PREFERENCE_LABELS[option]}</Text>
            </Pressable>
          );
        })}
      </View>
    </WizardStepScreen>
  );
}
