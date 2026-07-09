import { useState } from "react";
import { View, Text, TextInput, TouchableWithoutFeedback, Keyboard, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { getWizardStepNumber, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

export default function WizardStepSeventeenScreen() {
  const router = useRouter();
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const injuryNotes = useWizardDraftStore((s) => s.injuryNotes);
  const setInjuryNotes = useWizardDraftStore((s) => s.setInjuryNotes);
  const [injuryNotesInput, setInjuryNotesInput] = useState(injuryNotes || "");
  const totalSteps = getWizardTotalSteps(supplementUse);
  const currentStep = getWizardStepNumber(17, supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();

  return (
    <WizardStepScreen
      currentStep={currentStep}
      totalSteps={totalSteps}
      title="Anything else we should know about your injuries or limitations?"
      canGoBack
      isNextEnabled
      isNextLoading={isSaving}
      errorMessage={errorMessage}
      onNext={async () => {
        const didSave = await saveStep({ injuryNotes }, currentStep);
        if (didSave) {
          router.push("/(profile)/wizard/step-18");
        }
      }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View>
          <TextInput
            value={injuryNotesInput}
            onChangeText={(value) => {
              setInjuryNotesInput(value);
              setInjuryNotes(value.length > 0 ? value : null);
            }}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            multiline
            placeholder="Describe your injury (optional)"
            style={{ borderWidth: 1, width: "100%", padding: 8, minHeight: 120, textAlignVertical: "top" }}
          />
          <Pressable onPress={Keyboard.dismiss} style={{ paddingVertical: 6, paddingHorizontal: 10, alignSelf: "flex-end", marginTop: 8 }}>
            <Text style={{ color: "#666" }}>Done</Text>
          </Pressable>
        </View>
      </TouchableWithoutFeedback>
    </WizardStepScreen>
  );
}
