import { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

export default function WizardStepSixScreen() {
  const router = useRouter();
  const age = useWizardDraftStore((s) => s.age);
  const setAge = useWizardDraftStore((s) => s.setAge);
  const [ageInput, setAgeInput] = useState(age !== null ? String(age) : "");

  const parsedAge = Number(ageInput);
  const isAgeValid = Number.isInteger(parsedAge) && parsedAge >= 13 && parsedAge <= 100;
  const showError = ageInput.length > 0 && !isAgeValid;

  return (
    <WizardStepScreen
      currentStep={6}
      totalSteps={11}
      title="How old are you?"
      canGoBack
      isNextEnabled={isAgeValid}
      onNext={() => {
        if (!isAgeValid) return;
        setAge(parsedAge);
        router.push("/(profile)/wizard/step-7");
      }}
    >
      <View>
        <TextInput
          value={ageInput}
          onChangeText={(value) => {
            setAgeInput(value);
            const nextValue = Number(value);
            if (value.length === 0) {
              setAge(null);
            } else if (Number.isInteger(nextValue) && nextValue >= 13 && nextValue <= 100) {
              setAge(nextValue);
            }
          }}
          keyboardType="numeric"
          placeholder="Age"
          style={{ borderWidth: 1, width: "100%", padding: 8 }}
        />
        {showError && (
          <Text style={{ color: "red", fontSize: 12, marginTop: 8 }}>
            Age must be an integer between 13 and 100.
          </Text>
        )}
      </View>
    </WizardStepScreen>
  );
}
