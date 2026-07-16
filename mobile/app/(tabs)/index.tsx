import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../src/store/authStore";
import { getPrograms, getRegenerationRecommendation } from "../../src/api/programs";
import { getMyProgram } from "../../src/api/userPrograms";
import { startFromActiveProgram, getActiveSession, getMyCompletedSessions } from "../../src/api/sessions";
import { getSessionProgressions } from "../../src/api/progressions";
import { getLastSetForExercise, getTrend } from "../../src/utils/compareSets";
import { buildWorkoutName, estimateMinutes } from "../../src/utils/workoutMeta";
import { Program } from "../../src/types/program";
import { RegenerationInsightCard } from "../../src/components/RegenerationInsightCard";

function buildLastSessionSignal(recommendations: { recommendationType: string }[] | undefined): string | null {
  if (!recommendations || recommendations.length === 0) return null;
  const evaluable = recommendations.filter(
    (r: any) => r.reason !== "No sets were logged for this exercise; cannot evaluate progression."
  );
  if (evaluable.length === 0) return null;
  const increases = evaluable.filter((r) => r.recommendationType === "increase").length;
  const maintains = evaluable.filter((r) => r.recommendationType === "maintain").length;
  const deloads = evaluable.filter((r) => r.recommendationType === "deload").length;

  const parts: string[] = [];
  if (increases > 0) parts.push(`+${increases} increase${increases > 1 ? "s" : ""}`);
  if (maintains > 0) parts.push(`${maintains} maintain`);
  if (deloads > 0) parts.push(`${deloads} deload`);
  if (parts.length === 0) return null;
  return `Last session: ${parts.join(" / ")}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const { data: programs, isLoading, isError, error } = useQuery({
    queryKey: ["programs"],
    queryFn: getPrograms,
  });

  const { data: myProgram, isLoading: isMyProgramLoading } = useQuery({
    queryKey: ["myProgram"],
    queryFn: getMyProgram,
  });

  const { data: regenerationRecommendation, isLoading: isRegenerationLoading } = useQuery({
    queryKey: ["regenerationRecommendation"],
    queryFn: getRegenerationRecommendation,
    staleTime: 60 * 60 * 1000,
  });

  const { data: activeSession, isLoading: isActiveSessionLoading } = useQuery({
    queryKey: ["activeSession"],
    queryFn: getActiveSession,
  });

  const { data: completedSessions } = useQuery({
    queryKey: ["completedSessions"],
    queryFn: () => getMyCompletedSessions(user!.id),
    enabled: !!user,
  });

  const lastCompletedSessionId = completedSessions && completedSessions.length > 0 ? completedSessions[0].id : null;

  const { data: lastSessionProgressions } = useQuery({
    queryKey: ["lastSessionProgressions", lastCompletedSessionId],
    queryFn: () => getSessionProgressions(lastCompletedSessionId as number),
    enabled: !!lastCompletedSessionId,
  });

  const lastSessionSignal = buildLastSessionSignal(lastSessionProgressions);

  const lastWorkoutTrendLine = (() => {
    if (!completedSessions || completedSessions.length < 2) return null;
    const latest = completedSessions[0];
    const previous = completedSessions[1];
    const exerciseIds = new Set((latest.setLogs || []).map((s) => s.exerciseId));
    let improved = 0;
    let dropped = 0;
    for (const exId of exerciseIds) {
      const currentLast = getLastSetForExercise(latest, exId);
      const previousLast = getLastSetForExercise(previous, exId);
      if (!currentLast || !previousLast) continue;
      const trend = getTrend(currentLast, previousLast);
      if (trend === "up") improved += 1;
      if (trend === "down") dropped += 1;
    }
    if (improved === 0 && dropped === 0) return null;
    if (improved >= dropped) return `Last workout: \u2191 ${improved} exercise${improved !== 1 ? "s" : ""} improved`;
    return `Last workout: \u2193 ${dropped} exercise${dropped !== 1 ? "s" : ""} dropped`;
  })();

  const startWorkoutMutation = useMutation({
    mutationFn: startFromActiveProgram,
    onSuccess: (data) => {
      router.push({
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

  const onResume = () => {
    if (!activeSession) return;
    router.push({
      pathname: "/workout/[sessionId]",
      params: {
        sessionId: String(activeSession.session.id),
        programName: activeSession.program.name,
        dayName: activeSession.programDay.name,
        exercisesData: JSON.stringify(activeSession.exercises),
        existingSetLogsData: JSON.stringify(activeSession.session.setLogs || []),
      },
    });
  };

  const onLogout = async () => {
    await logout();
    queryClient.clear();
    router.replace("/(auth)/login");
  };

  const renderProgram = ({ item }: { item: Program }) => {
    const totalExercises = item.days.reduce((sum, day) => sum + day.exercises.length, 0);
    const isActive = myProgram?.programId === item.id;
    return (
      <Pressable
        onPress={() => router.push(`/programs/${item.id}`)}
        style={{
          borderWidth: isActive ? 2 : 1,
          borderColor: isActive ? "#4caf50" : "#000",
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
        }}
      >
        {isActive && <Text style={{ color: "#4caf50", fontWeight: "bold" }}>ACTIVE</Text>}
        <Text style={{ fontWeight: "bold", fontSize: 16 }}>{item.name}</Text>
        <Text>Goal: {item.goal}</Text>
        <Text>Split: {item.splitFamily}</Text>
        <Text>Days: {item.days.length}</Text>
        <Text>Total exercises: {totalExercises}</Text>
      </Pressable>
    );
  };

  const currentDay = myProgram?.program.days.find(
    (d) => d.dayIndex === myProgram.currentDayIndex
  );

  const nextDayCue = (() => {
    if (!myProgram) return null;
    const totalDays = myProgram.program.days.length;
    if (totalDays === 0) return null;
    const nextIndex = (myProgram.currentDayIndex + 1) % totalDays;
    const nextDay = myProgram.program.days.find((d) => d.dayIndex === nextIndex);
    if (!nextDay) return null;
    return `Next session: ${nextDay.name}`;
  })();

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 60 }}>
      <Text style={{ fontSize: 18, marginBottom: 4 }}>
        {user ? `Logged in as ${user.email}` : "No user"}
      </Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
        <Pressable onPress={onLogout} style={{ padding: 10, backgroundColor: "#ddd", alignSelf: "flex-start" }}>
          <Text>Logout</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/(onboarding)/intro")}
          style={{ padding: 10, alignSelf: "flex-start" }}
        >
          <Text style={{ color: "#2196f3", fontSize: 13 }}>How this works</Text>
        </Pressable>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold" }}>Active Program</Text>
        {isMyProgramLoading && <ActivityIndicator />}
        {!isMyProgramLoading && !myProgram && <Text>No active program yet</Text>}
        {myProgram && (
          <View>
            {currentDay && (() => {
              const workoutName = buildWorkoutName(currentDay.exercises);
              const minutes = estimateMinutes(currentDay.exercises);
              const exerciseCount = currentDay.exercises.length;
              return (
                <View>
                  <Text style={{ fontSize: 22, fontWeight: "bold", marginTop: 8 }}>
                    Today: {workoutName}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#666", marginTop: 2 }}>
                    {exerciseCount} exercises • ~{minutes} min
                  </Text>
                </View>
              );
            })()}

            {isActiveSessionLoading && <ActivityIndicator style={{ marginTop: 14 }} />}

            {!isActiveSessionLoading && activeSession && (
              <Pressable
                onPress={onResume}
                style={{ padding: 18, backgroundColor: "#ff9800", borderRadius: 10, marginTop: 16, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "bold", fontSize: 18 }}>Resume Workout</Text>
              </Pressable>
            )}

            {!isActiveSessionLoading && !activeSession && currentDay && (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/workout/preview",
                    params: {
                      dayName: currentDay.name,
                      workoutName: buildWorkoutName(currentDay.exercises),
                      exerciseNames: JSON.stringify(currentDay.exercises.map((e) => e.exercise.nameFa)),
                    },
                  })
                }
                style={{ padding: 18, backgroundColor: "#2196f3", borderRadius: 10, marginTop: 16, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "bold", fontSize: 18 }}>Start Workout</Text>
              </Pressable>
            )}
            {startWorkoutMutation.isError && (
              <Text style={{ color: "red" }}>{(startWorkoutMutation.error as Error)?.message}</Text>
            )}

            <View style={{ marginTop: 12 }}>
              {!activeSession && nextDayCue && (
                <Text style={{ fontSize: 12, color: "#999" }}>{nextDayCue}</Text>
              )}
              {lastSessionSignal && (
                <Text style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{lastSessionSignal}</Text>
              )}
              {lastWorkoutTrendLine && (
                <Text style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{lastWorkoutTrendLine}</Text>
              )}
            </View>
          </View>
        )}
      </View>

      <RegenerationInsightCard
        recommendation={regenerationRecommendation}
        isLoading={isRegenerationLoading}
      />

      <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 12 }}>Programs</Text>

      {isLoading && <ActivityIndicator />}
      {isError && <Text style={{ color: "red" }}>Error loading programs: {(error as Error)?.message}</Text>}

      {programs && (
        <FlatList
          data={programs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProgram}
        />
      )}
    </View>
  );
}
