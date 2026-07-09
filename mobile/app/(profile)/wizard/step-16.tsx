import { ScrollView, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { INJURY_FLAG_LABELS, getWizardStepNumber, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const INJURY_FLAG_OPTIONS = ["knee", "shoulder", "lower_back", "wrist", "none"];

export default function WizardStepSixteenScreen() {
  const router = useRouter();
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const injuryFlags = useWizardDraftStore((s) => s.injuryFlags);
  const setInjuryFlags = useWizardDraftStore((s) => s.setInjuryFlags);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const currentStep = getWizardStepNumber(16, supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();

  const toggleInjuryFlag = (option: string) => {
    if (option === "none") {
      setInjuryFlags(["none"]);
      return;
    }

    const current = injuryFlags.filter((item) => item !== "none");
    if (current.includes(option)) {
      setInjuryFlags(current.filter((item) => item !== option));
      return;
    }

    setInjuryFlags([...current, option]);
  };

  return (
    <WizardStepScreen
      currentStep={currentStep}
      totalSteps={totalSteps}
      title="Any injuries or limitations to consider?"
      canGoBack
      isNextEnabled={injuryFlags.length > 0}
      isNextLoading={isSaving}
      errorMessage={errorMessage}
      onNext={async () => {
        if (injuryFlags.length === 0) return;
        const didSave = await saveStep({ injuryFlags }, currentStep);
        if (!didSave) return;
        router.push(
          injuryFlags.includes("none") || injuryFlags.length === 0
            ? "/(profile)/wizard/step-18"
            : "/(profile)/wizard/step-17"
        );
      }}
    >
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        {INJURY_FLAG_OPTIONS.map((option) => {
          const isSelected = injuryFlags.includes(option);
          return (
            <Pressable
              key={option}
              onPress={() => toggleInjuryFlag(option)}
              style={{
                padding: 16,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isSelected ? "#2196f3" : "#ddd",
                backgroundColor: isSelected ? "#e3f2fd" : "#fff",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>
                {INJURY_FLAG_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </WizardStepScreen>
  );
}
