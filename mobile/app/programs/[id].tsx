import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProgramById } from "../../src/api/programs";
import { activateProgram } from "../../src/api/userPrograms";

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const programId = Number(id);

  const { data: program, isLoading, isError, error } = useQuery({
    queryKey: ["program", programId],
    queryFn: () => getProgramById(programId),
    enabled: !Number.isNaN(programId),
  });

  const activateMutation = useMutation({
    mutationFn: () => activateProgram(programId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myProgram"] });
      router.replace("/(tabs)");
    },
  });

  return (
    <ScrollView style={{ flex: 1, padding: 20, paddingTop: 60 }}>
      <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
        <Text>{`\u2190 Back`}</Text>
      </Pressable>

      {isLoading && <ActivityIndicator />}
      {isError && <Text style={{ color: "red" }}>Error: {(error as Error)?.message}</Text>}

      {program && (
        <View>
          <Text style={{ fontSize: 22, fontWeight: "bold" }}>{program.name}</Text>
          <Text>Goal: {program.goal}</Text>
          <Text style={{ marginBottom: 16 }}>Split: {program.splitFamily}</Text>

          <Pressable
            onPress={() => activateMutation.mutate()}
            disabled={activateMutation.isPending}
            style={{ padding: 14, backgroundColor: "#4caf50", borderRadius: 8, marginBottom: 20, alignItems: "center" }}
          >
            <Text style={{ color: "white", fontWeight: "bold" }}>
              {activateMutation.isPending ? "Activating..." : "Activate Program"}
            </Text>
          </Pressable>
          {activateMutation.isError && (
            <Text style={{ color: "red", marginBottom: 12 }}>
              {(activateMutation.error as Error)?.message}
            </Text>
          )}

          {program.days
            .sort((a, b) => a.dayIndex - b.dayIndex)
            .map((day) => (
              <View key={day.id} style={{ marginBottom: 20, borderTopWidth: 1, paddingTop: 12 }}>
                <Text style={{ fontWeight: "bold", fontSize: 16, marginBottom: 8 }}>{day.name}</Text>
                {day.exercises
                  .sort((a, b) => a.order - b.order)
                  .map((pde) => (
                    <View key={pde.id} style={{ marginBottom: 10 }}>
                      <Text style={{ fontWeight: "600" }}>{pde.exercise.nameFa}</Text>
                      <Text>
                        {pde.sets} sets x {pde.repRangeLow}-{pde.repRangeHigh} reps · rest {pde.restSeconds}s
                      </Text>
                    </View>
                  ))}
              </View>
            ))}
        </View>
      )}
    </ScrollView>
  );
}
