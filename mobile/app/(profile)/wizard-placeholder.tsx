import { View, Text } from "react-native";

export default function WizardPlaceholderScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      {/* Phase 3 temporary placeholder. Replace with the real Fitness Profile Wizard in Phase 4. */}
      <Text style={{ fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 8 }}>
        Fitness Profile Wizard
      </Text>
      <Text style={{ fontSize: 16, color: "#555", textAlign: "center" }}>
        Coming in Phase 4
      </Text>
    </View>
  );
}
