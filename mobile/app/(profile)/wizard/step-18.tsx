import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ApiError } from "../../../src/api/client";
import { completeProfile } from "../../../src/api/profile";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";
import {
  CARDIO_PREFERENCE_LABELS,
  EQUIPMENT_LABELS,
  GOAL_LABELS,
  INJURY_FLAG_LABELS,
  NUTRITION_HABITS_LABELS,
  OCCUPATION_TYPE_LABELS,
  RECOVERY_QUALITY_LABELS,
  SEX_LABELS,
  SUPPLEMENT_LABELS,
  TRAINING_LEVEL_LABELS,
  getLabel,
  getLabelList,
  getWizardStepNumber,
  getWizardTotalSteps,
} from "../../../src/constants/wizardLabels";

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
  const totalSteps = getWizardTotalSteps(draft.supplementUse);
  const currentStep = getWizardStepNumber(18, draft.supplementUse);
  const [isCompleting, setIsCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const onCreateProgram = async () => {
    setIsCompleting(true);
    setErrorMessage(null);

    try {
      await completeProfile();
      router.replace("/");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Couldn't complete your profile. Check your connection and try again.");
      }
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 60 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Text style={{ fontSize: 13, color: "#777" }}>Step {currentStep} of {totalSteps}</Text>
        <Pressable onPress={onLogout} style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
          <Text style={{ color: "#666" }}>Logout</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>Your AI Profile</Text>
        <Text style={{ fontSize: 15, color: "#555", marginBottom: 20 }}>
          Based on your answers, our AI will build a training program tailored to your goals, body, and lifestyle.
        </Text>

        <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>Training</Text>
        <SummaryRow label="Goal" value={getLabel(GOAL_LABELS, draft.goal)} />
        <SummaryRow label="Training Level" value={getLabel(TRAINING_LEVEL_LABELS, draft.trainingLevel)} />
        <SummaryRow label="Training Days Per Week" value={draft.trainingDaysPerWeek !== null ? String(draft.trainingDaysPerWeek) : "Not provided"} />
        <SummaryRow label="Session Duration" value={draft.sessionDurationMin !== null ? `${draft.sessionDurationMin} minutes` : "Not provided"} />
        <SummaryRow label="Equipment Access" value={getLabelList(EQUIPMENT_LABELS, draft.equipmentAccess)} />

        <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12, marginTop: 8 }}>Body</Text>
        <SummaryRow label="Age" value={draft.age !== null ? String(draft.age) : "Not provided"} />
        <SummaryRow label="Sex" value={getLabel(SEX_LABELS, draft.sex)} />
        <SummaryRow label="Height" value={draft.heightCm !== null ? `${draft.heightCm} cm` : "Not provided"} />
        <SummaryRow label="Weight" value={draft.weightKg !== null ? `${draft.weightKg} kg` : "Not provided"} />

        <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12, marginTop: 8 }}>Lifestyle</Text>
        <SummaryRow label="Occupation Type" value={getLabel(OCCUPATION_TYPE_LABELS, draft.occupationType)} />
        <SummaryRow label="Nutrition Habits" value={getLabel(NUTRITION_HABITS_LABELS, draft.nutritionHabits)} />
        <SummaryRow label="Meal Frequency" value={draft.mealFrequency !== null ? `${draft.mealFrequency} meals per day` : "Not provided"} />
        <SummaryRow label="Cardio Preference" value={getLabel(CARDIO_PREFERENCE_LABELS, draft.cardioPreference)} />
        <SummaryRow label="Supplement Use" value={getLabelList(SUPPLEMENT_LABELS, draft.supplementUse)} />
        {draft.supplementUse.includes("other") && draft.supplementOther ? (
          <SummaryRow label="Other Supplements" value={draft.supplementOther} />
        ) : null}

        <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12, marginTop: 8 }}>Health</Text>
        <SummaryRow label="Recovery Quality" value={getLabel(RECOVERY_QUALITY_LABELS, draft.recoveryQuality)} />
        <SummaryRow label="Injury Flags" value={getLabelList(INJURY_FLAG_LABELS, draft.injuryFlags)} />
        {draft.injuryNotes ? <SummaryRow label="Injury Notes" value={draft.injuryNotes} /> : null}

        <View style={{ backgroundColor: "#f5f5f5", borderRadius: 10, padding: 16, marginTop: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>What happens next?</Text>
          <Text style={{ fontSize: 14, marginBottom: 4 }}>✓ Analyze your profile</Text>
          <Text style={{ fontSize: 14, marginBottom: 4 }}>✓ Build your personalized training plan</Text>
          <Text style={{ fontSize: 14, marginBottom: 4 }}>✓ Adapt exercises to your equipment</Text>
          <Text style={{ fontSize: 14 }}>✓ Optimize recovery and progression</Text>
        </View>
      </ScrollView>

      {errorMessage ? <Text style={{ color: "red", fontSize: 12, marginBottom: 12 }}>{errorMessage}</Text> : null}

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 24 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ paddingVertical: 14, paddingHorizontal: 20, backgroundColor: "#ddd", borderRadius: 10 }}
        >
          <Text>Back</Text>
        </Pressable>

        <Pressable
          onPress={onCreateProgram}
          disabled={isCompleting}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 20,
            backgroundColor: isCompleting ? "#bbdefb" : "#2196f3",
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>{isCompleting ? "Saving..." : "Build My AI Program"}</Text>
        </Pressable>
      </View>
    </View>
  );
}
