import { Text } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";

export default function WizardStepTwoScreen() {
  const router = useRouter();

  return (
    <WizardStepScreen
      currentStep={2}
      totalSteps={3}
      title="Fitness Profile Wizard"
      canGoBack
      isNextEnabled
      onNext={() => router.push("/(profile)/wizard/step-3")}
    >
      <Text style={{ fontSize: 16, color: "#555" }}>Step 2 placeholder content</Text>
    </WizardStepScreen>
  );
}
