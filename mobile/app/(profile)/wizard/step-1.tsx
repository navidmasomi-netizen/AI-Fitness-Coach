import { Text } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";

export default function WizardStepOneScreen() {
  const router = useRouter();

  return (
    <WizardStepScreen
      currentStep={1}
      totalSteps={3}
      title="Fitness Profile Wizard"
      canGoBack={false}
      isNextEnabled
      onNext={() => router.push("/(profile)/wizard/step-2")}
    >
      <Text style={{ fontSize: 16, color: "#555" }}>Step 1 placeholder content</Text>
    </WizardStepScreen>
  );
}
