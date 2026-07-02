import { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

export default function WizardStepNineScreen() {
  const router = useRouter();
  const weightKg = useWizardDraftStore((s) => s.weightKg);
  const setWeightKg = useWizardDraftStore((s) => s.setWeightKg);
  const [weightInput, setWeightInput] = useState(weightKg !== null ? String(weightKg) : "");

  const parsedWeight = Number(weightInput);
  const isWeightValid = !Number.isNaN(parsedWeight) && parsedWeight >= 20 && parsedWeight <= 400;
  const showError = weightInput.length > 0 && !isWeightValid;

  return (
    <WizardStepScreen
      currentStep={9}
      totalSteps={11}
      title="What is your weight in kg?"
      canGoBack
      isNextEnabled={isWeightValid}
      onNext={() => {
        if (!isWeightValid) return;
        setWeightKg(parsedWeight);
        router.push("/(profile)/wizard/step-10");
      }}
    >
      <View>
        <TextInput
          value={weightInput}
          onChangeText={(value) => {
            setWeightInput(value);
            const nextValue = Number(value);
            if (value.length === 0) {
              setWeightKg(null);
            } else if (!Number.isNaN(nextValue) && nextValue >= 20 && nextValue <= 400) {
              setWeightKg(nextValue);
            }
          }}
          keyboardType="numeric"
          placeholder="Weight in kg"
          style={{ borderWidth: 1, width: "100%", padding: 8 }}
        />
        {showError && (
          <Text style={{ color: "red", fontSize: 12, marginTop: 8 }}>
            Weight must be between 20 and 400 kg.
          </Text>
        )}
      </View>
    </WizardStepScreen>
  );
}
