import { View, Text, FlatList, ActivityIndicator, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../src/store/authStore";
import { getMyCompletedSessions } from "../../src/api/sessions";
import { WorkoutSession } from "../../src/types/session";

export default function HistoryScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: sessions, isLoading, isError, error } = useQuery({
    queryKey: ["completedSessions"],
    queryFn: () => getMyCompletedSessions(user!.id),
    enabled: !!user,
  });

  const renderSession = ({ item }: { item: WorkoutSession & { program?: any; programDay?: any } }) => {
    const totalSets = item.setLogs?.length || 0;
    const uniqueExercises = new Set((item.setLogs || []).map((s: any) => s.exerciseId)).size;

    return (
      <Pressable
        onPress={() => router.push(`/workout/summary/${item.id}`)}
        style={{ borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 12 }}
      >
        <Text style={{ fontWeight: "bold", fontSize: 16 }}>
          {item.program?.name || "Unknown Program"}
        </Text>
        <Text>{item.programDay?.name || ""}</Text>
        <Text style={{ color: "#666" }}>
          {item.completedAt ? new Date(item.completedAt).toLocaleString() : ""}
        </Text>
        <Text>Total sets: {totalSets}</Text>
        <Text>Exercises logged: {uniqueExercises}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 60 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 16 }}>Workout History</Text>

      {isLoading && <ActivityIndicator />}
      {isError && <Text style={{ color: "red" }}>{(error as Error)?.message}</Text>}
      {sessions && sessions.length === 0 && <Text>No completed workouts yet</Text>}

      {sessions && sessions.length > 0 && (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderSession}
        />
      )}
    </View>
  );
}
