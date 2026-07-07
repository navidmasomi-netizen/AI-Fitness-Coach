import { useState } from "react";
import { View, TextInput, TouchableWithoutFeedback, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

export default function WizardStepFifteenBScreen() {
  const router = useRouter();
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const supplementOther = useWizardDraftStore((s) => s.supplementOther);
  const setSupplementOther = useWizardDraftStore((s) => s.setSupplementOther);
  const [supplementOtherInput, setSupplementOtherInput] = useState(supplementOther || "");
  const totalSteps = getWizardTotalSteps(supplementUse);

  return (
    <WizardStepScreen
      currentStep={16}
      totalSteps={totalSteps}
      title="What other supplements do you use?"
      canGoBack
      isNextEnabled
      onNext={() => router.push("/(profile)/wizard/step-16")}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View>
          <TextInput
            value={supplementOtherInput}
            onChangeText={(value) => {
              setSupplementOtherInput(value);
              setSupplementOther(value.length > 0 ? value : null);
            }}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            multiline
            placeholder="Other supplements (optional)"
            style={{ borderWidth: 1, width: "100%", padding: 8, minHeight: 120, textAlignVertical: "top" }}
          />
        </View>
      </TouchableWithoutFeedback>
    </WizardStepScreen>
  );
}
