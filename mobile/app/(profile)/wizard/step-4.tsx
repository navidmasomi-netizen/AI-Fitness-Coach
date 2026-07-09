import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const SESSION_DURATION_OPTIONS = [30, 45, 60, 75, 90];

export default function WizardStepFourScreen() {
  const router = useRouter();
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const sessionDurationMin = useWizardDraftStore((s) => s.sessionDurationMin);
  const setSessionDurationMin = useWizardDraftStore((s) => s.setSessionDurationMin);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();

  return (
    <WizardStepScreen
      currentStep={4}
      totalSteps={totalSteps}
      title="How long should each session be?"
      canGoBack
      isNextEnabled={sessionDurationMin !== null}
      isNextLoading={isSaving}
      errorMessage={errorMessage}
      onNext={async () => {
        if (sessionDurationMin === null) return;
        const didSave = await saveStep({ sessionDurationMin }, 4);
        if (didSave) {
          router.push("/(profile)/wizard/step-5");
        }
      }}
    >
      <View style={{ gap: 10 }}>
        {SESSION_DURATION_OPTIONS.map((option) => {
          const isSelected = sessionDurationMin === option;
          return (
            <Pressable
              key={option}
              onPress={() => setSessionDurationMin(option)}
              style={{
                padding: 16,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isSelected ? "#2196f3" : "#ddd",
                backgroundColor: isSelected ? "#e3f2fd" : "#fff",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>
                {option} minutes
              </Text>
            </Pressable>
          );
        })}
      </View>
    </WizardStepScreen>
  );
}
