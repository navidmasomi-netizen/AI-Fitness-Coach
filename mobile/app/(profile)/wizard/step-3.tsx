import { Text } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";

export default function WizardStepThreeScreen() {
  const router = useRouter();

  return (
    <WizardStepScreen
      currentStep={3}
      totalSteps={3}
      title="Fitness Profile Wizard"
      canGoBack
      isNextEnabled
      onNext={() => router.push("/(profile)/wizard/complete")}
    >
      <Text style={{ fontSize: 16, color: "#555" }}>Step 3 placeholder content</Text>
    </WizardStepScreen>
  );
}
