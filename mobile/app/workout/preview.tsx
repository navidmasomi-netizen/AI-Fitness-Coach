import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { startFromActiveProgram } from "../../src/api/sessions";

export default function WorkoutPreviewScreen() {
  const { dayName, workoutName, exerciseNames } = useLocalSearchParams<{
    dayName: string;
    workoutName: string;
    exerciseNames: string;
  }>();
  const router = useRouter();

  const names: string[] = exerciseNames ? JSON.parse(exerciseNames) : [];

  const startMutation = useMutation({
    mutationFn: startFromActiveProgram,
    onSuccess: (data) => {
      router.replace({
        pathname: "/workout/[sessionId]",
        params: {
          sessionId: String(data.session.id),
          programName: data.program.name,
          dayName: data.programDay.name,
          exercisesData: JSON.stringify(data.exercises),
          existingSetLogsData: JSON.stringify(data.session.setLogs || []),
        },
      });
    },
  });

  return (
    <ScrollView style={{ flex: 1, padding: 20, paddingTop: 60 }}>
      <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
        <Text>{`\u2190 Back`}</Text>
      </Pressable>

      <Text style={{ fontSize: 22, fontWeight: "bold" }}>Today's Workout</Text>
      <Text style={{ fontSize: 16, color: "#555", marginTop: 4, marginBottom: 20 }}>
        {dayName} — {workoutName}
      </Text>

      {names.map((name, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ fontWeight: "bold", width: 24 }}>{i + 1}.</Text>
          <Text style={{ fontSize: 16 }}>{name}</Text>
        </View>
      ))}

      <Pressable
        onPress={() => startMutation.mutate()}
        disabled={startMutation.isPending}
        style={{ padding: 18, backgroundColor: "#2196f3", borderRadius: 10, marginTop: 28, alignItems: "center" }}
      >
        <Text style={{ color: "white", fontWeight: "bold", fontSize: 18 }}>
          {startMutation.isPending ? "Starting..." : "Start Session"}
        </Text>
      </Pressable>
      {startMutation.isError && (
        <Text style={{ color: "red", marginTop: 8 }}>{(startMutation.error as Error)?.message}</Text>
      )}
    </ScrollView>
  );
}
