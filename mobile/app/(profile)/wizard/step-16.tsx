import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const INJURY_FLAG_OPTIONS = ["knee", "shoulder", "lower_back", "wrist", "none"];

export default function WizardStepSixteenScreen() {
  const router = useRouter();
  const injuryFlags = useWizardDraftStore((s) => s.injuryFlags);
  const setInjuryFlags = useWizardDraftStore((s) => s.setInjuryFlags);

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
      currentStep={16}
      totalSteps={18}
      title="Any injuries or limitations to consider?"
      canGoBack
      isNextEnabled={injuryFlags.length > 0}
      onNext={() =>
        router.push(
          injuryFlags.length === 0 || injuryFlags.includes("none")
            ? "/(profile)/wizard/step-18"
            : "/(profile)/wizard/step-17"
        )
      }
    >
      <View style={{ gap: 10 }}>
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
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </WizardStepScreen>
  );
}
