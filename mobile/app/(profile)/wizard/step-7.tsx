import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { SEX_LABELS, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const SEX_OPTIONS = ["male", "female"];

export default function WizardStepSevenScreen() {
  const router = useRouter();
  const sex = useWizardDraftStore((s) => s.sex);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const setSex = useWizardDraftStore((s) => s.setSex);
  const totalSteps = getWizardTotalSteps(supplementUse);

  return (
    <WizardStepScreen
      currentStep={7}
      totalSteps={totalSteps}
      title="What is your sex?"
      canGoBack
      isNextEnabled={sex !== null}
      onNext={() => router.push("/(profile)/wizard/step-8")}
    >
      <View style={{ gap: 10 }}>
        {SEX_OPTIONS.map((option) => {
          const isSelected = sex === option;
          return (
            <Pressable
              key={option}
              onPress={() => setSex(option)}
              style={{
                padding: 16,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isSelected ? "#2196f3" : "#ddd",
                backgroundColor: isSelected ? "#e3f2fd" : "#fff",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>{SEX_LABELS[option]}</Text>
            </Pressable>
          );
        })}
      </View>
    </WizardStepScreen>
  );
}
