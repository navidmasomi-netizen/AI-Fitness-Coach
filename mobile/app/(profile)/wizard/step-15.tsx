import { ScrollView, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { SUPPLEMENT_LABELS, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const SUPPLEMENT_OPTIONS = [
  "none",
  "protein",
  "creatine",
  "omega3",
  "multivitamin",
  "vitamin_d",
  "magnesium",
  "fish_oil",
  "electrolytes",
  "pre_workout",
  "other",
];

export default function WizardStepFifteenScreen() {
  const router = useRouter();
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const setSupplementUse = useWizardDraftStore((s) => s.setSupplementUse);
  const totalSteps = getWizardTotalSteps(supplementUse);

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
      totalSteps={totalSteps}
      title="Which supplements do you use?"
      canGoBack
      isNextEnabled={supplementUse.length > 0}
      onNext={() =>
        router.push(
          supplementUse.includes("other") ? "/(profile)/wizard/step-15b" : "/(profile)/wizard/step-16"
        )
      }
    >
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
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
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>
                {SUPPLEMENT_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </WizardStepScreen>
  );
}
