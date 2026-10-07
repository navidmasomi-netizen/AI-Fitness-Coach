import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useRunpuyTheme } from "../../src/design-system/theme-context";
import { iconography } from "../../src/design-system/tokens";

export default function TabsLayout() {
  const { theme } = useRunpuyTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.canvas },
        tabBarActiveTintColor: theme.colors.actionPrimary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.borderSubtle,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={iconography.grid} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => (
            <Feather name="clock" size={iconography.grid} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
