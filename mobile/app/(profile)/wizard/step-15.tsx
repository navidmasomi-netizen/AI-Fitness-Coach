import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const SUPPLEMENT_OPTIONS = ["protein", "creatine", "multivitamin", "omega3", "pre_workout", "none"];

export default function WizardStepFifteenScreen() {
  const router = useRouter();
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const setSupplementUse = useWizardDraftStore((s) => s.setSupplementUse);

  const toggleSupplement = (option: string) => {
    if (option === "none") {
      setSupplementUse(["none"]);
      return;
    }

    const current = supplementUse.filter((item) => item !== "none");
    if (current.includes(option)) {
      setSupplementUse(current.filter((item) => item !== option));
      return;
    }

    setSupplementUse([...current, option]);
  };

  return (
    <WizardStepScreen
      currentStep={15}
      totalSteps={18}
      title="Which supplements do you use?"
      canGoBack
      isNextEnabled={supplementUse.length > 0}
      onNext={() => router.push("/(profile)/wizard/step-16")}
    >
      <View style={{ gap: 10 }}>
        {SUPPLEMENT_OPTIONS.map((option) => {
          const isSelected = supplementUse.includes(option);
          return (
            <Pressable
              key={option}
              onPress={() => toggleSupplement(option)}
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
