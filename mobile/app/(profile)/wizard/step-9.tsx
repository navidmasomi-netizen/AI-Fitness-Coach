import { useState } from "react";
import { View, Text, TextInput, TouchableWithoutFeedback, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

export default function WizardStepNineScreen() {
  const router = useRouter();
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const weightKg = useWizardDraftStore((s) => s.weightKg);
  const setWeightKg = useWizardDraftStore((s) => s.setWeightKg);
  const [weightInput, setWeightInput] = useState(weightKg !== null ? String(weightKg) : "");
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();

  const parsedWeight = Number(weightInput);
  const isWeightValid = !Number.isNaN(parsedWeight) && parsedWeight >= 20 && parsedWeight <= 400;
  const showError = weightInput.length > 0 && !isWeightValid;

  return (
    <WizardStepScreen
      currentStep={9}
      totalSteps={totalSteps}
      title="What is your weight in kg?"
      canGoBack
      isNextEnabled={isWeightValid}
      isNextLoading={isSaving}
      errorMessage={errorMessage}
      onNext={() => {
        if (!isWeightValid) return;
        saveStep({ weightKg: parsedWeight }, 9).then((didSave) => {
          if (!didSave) return;
          setWeightKg(parsedWeight);
          router.push("/(profile)/wizard/step-10");
        });
      }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
            onSubmitEditing={Keyboard.dismiss}
            keyboardType="numeric"
            returnKeyType="done"
            placeholder="Weight in kg"
            style={{ borderWidth: 1, width: "100%", padding: 8 }}
          />
          {showError && (
            <Text style={{ color: "red", fontSize: 12, marginTop: 8 }}>
              Weight must be between 20 and 400 kg.
            </Text>
          )}
        </View>
      </TouchableWithoutFeedback>
    </WizardStepScreen>
  );
}
