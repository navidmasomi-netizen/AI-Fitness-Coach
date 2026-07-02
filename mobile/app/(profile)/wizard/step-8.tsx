import { useState } from "react";
import { View, Text, TextInput, TouchableWithoutFeedback, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

export default function WizardStepEightScreen() {
  const router = useRouter();
  const heightCm = useWizardDraftStore((s) => s.heightCm);
  const setHeightCm = useWizardDraftStore((s) => s.setHeightCm);
  const [heightInput, setHeightInput] = useState(heightCm !== null ? String(heightCm) : "");

  const parsedHeight = Number(heightInput);
  const isHeightValid = !Number.isNaN(parsedHeight) && parsedHeight >= 100 && parsedHeight <= 250;
  const showError = heightInput.length > 0 && !isHeightValid;

  return (
    <WizardStepScreen
      currentStep={8}
      totalSteps={11}
      title="What is your height in cm?"
      canGoBack
      isNextEnabled={isHeightValid}
      onNext={() => {
        if (!isHeightValid) return;
        setHeightCm(parsedHeight);
        router.push("/(profile)/wizard/step-9");
      }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View>
          <TextInput
            value={heightInput}
            onChangeText={(value) => {
              setHeightInput(value);
              const nextValue = Number(value);
              if (value.length === 0) {
                setHeightCm(null);
              } else if (!Number.isNaN(nextValue) && nextValue >= 100 && nextValue <= 250) {
                setHeightCm(nextValue);
              }
            }}
            onSubmitEditing={Keyboard.dismiss}
            keyboardType="numeric"
            returnKeyType="done"
            placeholder="Height in cm"
            style={{ borderWidth: 1, width: "100%", padding: 8 }}
          />
          {showError && (
            <Text style={{ color: "red", fontSize: 12, marginTop: 8 }}>
              Height must be between 100 and 250 cm.
            </Text>
          )}
        </View>
      </TouchableWithoutFeedback>
    </WizardStepScreen>
  );
}
