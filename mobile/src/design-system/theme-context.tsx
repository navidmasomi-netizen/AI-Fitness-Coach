import { createContext, type ReactNode, useContext } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type RunpuyTheme } from './themes';

export type RunpuyColorScheme = 'light' | 'dark';

type RunpuyThemeContextValue = {
  theme: RunpuyTheme;
  scheme: RunpuyColorScheme;
};

const lightThemeFallback: RunpuyThemeContextValue = {
  theme: lightTheme,
  scheme: 'light',
};

const RunpuyThemeContext = createContext<RunpuyThemeContextValue>(lightThemeFallback);

export function RunpuyThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const scheme: RunpuyColorScheme = colorScheme === 'dark' ? 'dark' : 'light';
  const theme = scheme === 'dark' ? darkTheme : lightTheme;

  return <RunpuyThemeContext.Provider value={{ theme, scheme }}>{children}</RunpuyThemeContext.Provider>;
}

export function useRunpuyTheme(): RunpuyThemeContextValue {
  return useContext(RunpuyThemeContext);
}
