import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

function renderValue(value: string | number | null) {
  if (value === null || value === "") return "Not provided";
  return String(value);
}

function renderList(values: string[]) {
  if (!values || values.length === 0) return "Not provided";
  return values.join(", ");
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, color: "#777", marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 16 }}>{value}</Text>
    </View>
  );
}

export default function WizardStepEighteenScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const draft = useWizardDraftStore();

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const onCreateProgram = () => {
    // Phase 4C will replace this placeholder with backend profile completion + program creation.
    console.log("Create My Program tapped - Phase 4C will wire this to backend submission");
    Alert.alert("Phase 4C", "Create My Program will be connected in Phase 4C.");
  };

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 60 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Text style={{ fontSize: 13, color: "#777" }}>Step 18 of 18</Text>
        <Pressable onPress={onLogout} style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
          <Text style={{ color: "#666" }}>Logout</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>Your AI Profile</Text>

        <SummaryRow label="Goal" value={renderValue(draft.goal)} />
        <SummaryRow label="Training Level" value={renderValue(draft.trainingLevel)} />
        <SummaryRow label="Training Days Per Week" value={renderValue(draft.trainingDaysPerWeek)} />
        <SummaryRow label="Session Duration" value={draft.sessionDurationMin !== null ? `${draft.sessionDurationMin} minutes` : "Not provided"} />
        <SummaryRow label="Equipment Access" value={renderList(draft.equipmentAccess)} />
        <SummaryRow label="Age" value={renderValue(draft.age)} />
        <SummaryRow label="Sex" value={renderValue(draft.sex)} />
        <SummaryRow label="Height" value={draft.heightCm !== null ? `${draft.heightCm} cm` : "Not provided"} />
        <SummaryRow label="Weight" value={draft.weightKg !== null ? `${draft.weightKg} kg` : "Not provided"} />
        <SummaryRow label="Occupation Type" value={renderValue(draft.occupationType)} />
        <SummaryRow label="Recovery Quality" value={renderValue(draft.recoveryQuality)} />
        <SummaryRow label="Nutrition Habits" value={renderValue(draft.nutritionHabits)} />
        <SummaryRow label="Meal Frequency" value={draft.mealFrequency !== null ? `${draft.mealFrequency} meals per day` : "Not provided"} />
        <SummaryRow label="Cardio Preference" value={renderValue(draft.cardioPreference)} />
        <SummaryRow label="Supplement Use" value={renderList(draft.supplementUse)} />
        <SummaryRow label="Injury Flags" value={renderList(draft.injuryFlags)} />
        {draft.injuryNotes ? <SummaryRow label="Injury Notes" value={draft.injuryNotes} /> : null}
      </ScrollView>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 24 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ paddingVertical: 14, paddingHorizontal: 20, backgroundColor: "#ddd", borderRadius: 10 }}
        >
          <Text>Back</Text>
        </Pressable>

        <Pressable
          onPress={onCreateProgram}
          style={{ paddingVertical: 14, paddingHorizontal: 20, backgroundColor: "#2196f3", borderRadius: 10 }}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>Create My Program</Text>
        </Pressable>
      </View>
    </View>
  );
}
