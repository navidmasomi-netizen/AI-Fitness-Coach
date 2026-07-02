import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { markIntroSeen } from "../../src/store/onboardingStorage";

const CARDS = [
  {
    title: "Follow today's workout",
    body: "We show exactly what to train today.",
  },
  {
    title: "Log your sets",
    body: "Record reps and weight during the workout.",
  },
  {
    title: "Improve next time",
    body: "After each session, you'll get progression suggestions.",
  },
];

export default function IntroScreen() {
  const router = useRouter();

  const onContinue = async () => {
    await markIntroSeen();
    router.replace("/");
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 70, justifyContent: "space-between" }}>
      <View>
        <Text style={{ fontSize: 26, fontWeight: "bold", marginBottom: 28 }}>Your workout coach</Text>

        {CARDS.map((card, i) => (
          <View
            key={i}
            style={{ backgroundColor: "#f5f5f5", borderRadius: 10, padding: 16, marginBottom: 14 }}
          >
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 4 }}>{card.title}</Text>
            <Text style={{ fontSize: 14, color: "#555" }}>{card.body}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onContinue}
        style={{ padding: 18, backgroundColor: "#2196f3", borderRadius: 10, alignItems: "center", marginTop: 20 }}
      >
        <Text style={{ color: "white", fontWeight: "bold", fontSize: 17 }}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}
