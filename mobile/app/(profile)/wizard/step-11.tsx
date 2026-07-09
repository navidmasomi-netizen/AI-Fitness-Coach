import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { RECOVERY_QUALITY_LABELS, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const RECOVERY_QUALITY_OPTIONS = ["low", "medium", "high"];

export default function WizardStepElevenScreen() {
  const router = useRouter();
  const recoveryQuality = useWizardDraftStore((s) => s.recoveryQuality);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const setRecoveryQuality = useWizardDraftStore((s) => s.setRecoveryQuality);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();

  return (
    <WizardStepScreen
      currentStep={11}
      totalSteps={totalSteps}
      title="How would you rate your recovery quality?"
      canGoBack
      isNextEnabled={recoveryQuality !== null}
      isNextLoading={isSaving}
      errorMessage={errorMessage}
      onNext={async () => {
        if (!recoveryQuality) return;
        const didSave = await saveStep({ recoveryQuality }, 11);
        if (didSave) {
          router.push("/(profile)/wizard/step-12");
        }
      }}
    >
      <View style={{ gap: 10 }}>
        {RECOVERY_QUALITY_OPTIONS.map((option) => {
          const isSelected = recoveryQuality === option;
          return (
            <Pressable
              key={option}
              onPress={() => setRecoveryQuality(option)}
              style={{
                padding: 16,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isSelected ? "#2196f3" : "#ddd",
                backgroundColor: isSelected ? "#e3f2fd" : "#fff",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>{RECOVERY_QUALITY_LABELS[option]}</Text>
            </Pressable>
          );
        })}
      </View>
    </WizardStepScreen>
  );
}
