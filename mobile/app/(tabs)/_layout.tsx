import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { darkTheme } from "../../src/design-system/themes";
import { iconography } from "../../src/design-system/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: darkTheme.colors.canvas },
        tabBarActiveTintColor: darkTheme.colors.actionPrimary,
        tabBarInactiveTintColor: darkTheme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: darkTheme.colors.card,
          borderTopColor: darkTheme.colors.borderSubtle,
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
