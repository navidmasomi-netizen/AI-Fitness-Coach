import { useState } from "react";
import { View, TextInput, TouchableWithoutFeedback, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

export default function WizardStepSeventeenScreen() {
  const router = useRouter();
  const injuryNotes = useWizardDraftStore((s) => s.injuryNotes);
  const setInjuryNotes = useWizardDraftStore((s) => s.setInjuryNotes);
  const [injuryNotesInput, setInjuryNotesInput] = useState(injuryNotes || "");

  return (
    <WizardStepScreen
      currentStep={17}
      totalSteps={18}
      title="Anything else we should know about your injuries or limitations?"
      canGoBack
      isNextEnabled
      onNext={() => router.push("/(profile)/wizard/step-18")}
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
            placeholder="Optional notes"
            style={{ borderWidth: 1, width: "100%", padding: 8, minHeight: 120, textAlignVertical: "top" }}
          />
        </View>
      </TouchableWithoutFeedback>
    </WizardStepScreen>
  );
}
