import { View } from "react-native";

import { RunpuyText } from "../../src/design-system/components";
import { useRunpuyTheme } from "../../src/design-system/theme-context";

export default function OnboardingScreen() {
  const { theme } = useRunpuyTheme();

  return (
    <View style={{ flex: 1, alignItems: "center", backgroundColor: theme.colors.canvas, justifyContent: "center" }}>
      <RunpuyText variant="body">Onboarding placeholder</RunpuyText>
    </View>
  );
}
