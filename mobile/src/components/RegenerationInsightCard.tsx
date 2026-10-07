import type { RegenerationRecommendation } from "../api/programs";
import { RunpuyButton, RunpuyCard, RunpuyText } from "../design-system/components";
import { useRunpuyTheme } from "../design-system/theme-context";
import { spacing } from "../design-system/tokens";

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
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);

  if (isLoading || !recommendation) {
    return null;
  }

  const isHealthyState =
    recommendation.regenerationRecommended === false || recommendation.urgency === "none";

  if (isHealthyState) {
    const headline = "Your current program is working well.";

    return (
      <RunpuyCard accessible accessibilityLabel={headline} style={styles.card}>
        <RunpuyText variant="title">
          {headline}
        </RunpuyText>
        <RunpuyText tone="secondary" variant="body">
          Keep training consistently. We'll let you know if a program refresh becomes worthwhile.
        </RunpuyText>
      </RunpuyCard>
    );
  }

  const headline = getHeadline(recommendation.urgency);
  const visibleReasons = recommendation.reasons.slice(0, 2);
  const indicatorLabel =
    recommendation.urgency === "high"
      ? "Profile update"
      : recommendation.urgency === "moderate"
        ? "Training insight"
        : null;

  return (
    <RunpuyCard accessible accessibilityLabel={headline} style={styles.card}>
      {indicatorLabel && (
        <RunpuyText variant="caption" style={styles.indicator}>
          {indicatorLabel}
        </RunpuyText>
      )}

      <RunpuyText variant="title">
        {headline}
      </RunpuyText>

      {visibleReasons.map((reason, index) => (
        <RunpuyText key={`${reason}-${index}`} tone="secondary" variant="body">
          {reason}
        </RunpuyText>
      ))}

      <RunpuyText tone="secondary" variant="caption">
        You can review this anytime.
      </RunpuyText>

      {isRegenerating ? (
        <RunpuyText accessibilityLiveRegion="polite" tone="secondary" variant="caption">
          Regenerating...
        </RunpuyText>
      ) : null}
      <RunpuyButton
        label="Regenerate Program"
        onPress={onRegenerate}
        loading={isRegenerating}
      />
    </RunpuyCard>
  );
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>["theme"]) => ({
  card: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  indicator: {
    color: theme.colors.information,
    textTransform: "uppercase" as const,
  },
} as const);
