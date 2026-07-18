import { View, Text, Pressable, ActivityIndicator } from "react-native";
import type { RegenerationRecommendation } from "../api/programs";

interface RegenerationInsightCardProps {
  recommendation: RegenerationRecommendation | null | undefined;
  isLoading: boolean;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

function getHeadline(urgency: RegenerationRecommendation["urgency"]) {
  if (urgency === "low") {
    return "Your program has been running for a while. A refresh might help keep things feeling fresh — no rush.";
  }

  if (urgency === "moderate") {
    return "Based on your recent sessions, an updated program might suit you better going forward.";
  }

  return "Something about your profile has changed since this program was built. It may be worth reviewing an updated version soon.";
}

export function RegenerationInsightCard({
  recommendation,
  isLoading,
  onRegenerate,
  isRegenerating,
}: RegenerationInsightCardProps) {
  if (isLoading || !recommendation) {
    return null;
  }

  const isHealthyState =
    recommendation.regenerationRecommended === false || recommendation.urgency === "none";

  if (isHealthyState) {
    const headline = "Your current program is working well.";

    return (
      <View
        accessible
        accessibilityLabel={headline}
        style={{
          backgroundColor: "#f5f7fb",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#d8e2f0",
          padding: 16,
          marginBottom: 20,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#16324f" }}>{headline}</Text>
        <Text style={{ fontSize: 13, color: "#5f6f82", marginTop: 6, lineHeight: 19 }}>
          Keep training consistently. We'll let you know if a program refresh becomes worthwhile.
        </Text>
      </View>
    );
  }

  const headline = getHeadline(recommendation.urgency);
  const visibleReasons = recommendation.reasons.slice(0, 2);
  const accentColor =
    recommendation.urgency === "high"
      ? "#5c7ea6"
      : recommendation.urgency === "moderate"
        ? "#6f8fb6"
        : "#8ba8c7";
  const backgroundColor =
    recommendation.urgency === "high"
      ? "#eef4fb"
      : recommendation.urgency === "moderate"
        ? "#f3f7fc"
        : "#f7f9fc";
  const indicatorLabel =
    recommendation.urgency === "high"
      ? "Profile update"
      : recommendation.urgency === "moderate"
        ? "Training insight"
        : null;

  return (
    <View
      accessible
      accessibilityLabel={headline}
      style={{
        backgroundColor,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#d8e2f0",
        borderLeftWidth: recommendation.urgency === "low" ? 3 : 5,
        borderLeftColor: accentColor,
        padding: 16,
        marginBottom: 20,
      }}
    >
      {indicatorLabel && (
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: accentColor,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {indicatorLabel}
        </Text>
      )}

      <Text
        style={{
          fontSize: recommendation.urgency === "high" ? 17 : 16,
          fontWeight: recommendation.urgency === "high" ? "700" : "600",
          color: "#16324f",
          lineHeight: 24,
        }}
      >
        {headline}
      </Text>

      {visibleReasons.map((reason, index) => (
        <Text
          key={`${reason}-${index}`}
          style={{ fontSize: 13, color: "#5f6f82", marginTop: 8, lineHeight: 19 }}
        >
          {reason}
        </Text>
      ))}

      <Text style={{ fontSize: 12, color: "#7a8796", marginTop: 10 }}>
        You can review this anytime.
      </Text>

      <Pressable
        onPress={onRegenerate}
        disabled={isRegenerating}
        style={{
          marginTop: 14,
          borderRadius: 8,
          backgroundColor: isRegenerating ? "#9db9d6" : accentColor,
          paddingVertical: 12,
          paddingHorizontal: 14,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
        }}
      >
        {isRegenerating ? <ActivityIndicator size="small" color="#ffffff" /> : null}
        <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 14 }}>
          {isRegenerating ? "Regenerating..." : "Regenerate Program"}
        </Text>
      </Pressable>
    </View>
  );
}
