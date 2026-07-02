import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { WizardStepScreen } from "../../../src/components/wizard/WizardStepScreen";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const EQUIPMENT_OPTIONS = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"];

export default function WizardStepFiveScreen() {
  const router = useRouter();
  const equipmentAccess = useWizardDraftStore((s) => s.equipmentAccess);
  const setEquipmentAccess = useWizardDraftStore((s) => s.setEquipmentAccess);

  const toggleEquipment = (option: string) => {
    if (equipmentAccess.includes(option)) {
      setEquipmentAccess(equipmentAccess.filter((item) => item !== option));
      return;
    }

    setEquipmentAccess([...equipmentAccess, option]);
  };

  return (
    <WizardStepScreen
      currentStep={5}
      totalSteps={5}
      title="What equipment do you have access to?"
      canGoBack
      isNextEnabled={equipmentAccess.length > 0}
      onNext={() => router.push("/(profile)/wizard/complete")}
    >
      <View style={{ gap: 10 }}>
        {EQUIPMENT_OPTIONS.map((option) => {
          const isSelected = equipmentAccess.includes(option);
          return (
            <Pressable
              key={option}
              onPress={() => toggleEquipment(option)}
              style={{
                padding: 16,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isSelected ? "#2196f3" : "#ddd",
                backgroundColor: isSelected ? "#e3f2fd" : "#fff",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400" }}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </WizardStepScreen>
  );
}
