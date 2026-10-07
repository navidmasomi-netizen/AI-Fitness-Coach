import type { ComponentProps, ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { useRunpuyTheme } from '../theme-context';
import type { RunpuyTextScript } from '../fonts';
import type { RunpuyTheme } from '../themes';
import { getRunpuyFontFamily, typography } from '../typography';

export type RunpuyTextVariant = keyof typeof typography;
export type RunpuyTextTone = 'primary' | 'secondary';

export type RunpuyTextProps = Omit<ComponentProps<typeof Text>, 'style' | 'children'> & {
  children: ReactNode;
  variant?: RunpuyTextVariant;
  tone?: RunpuyTextTone;
  script?: RunpuyTextScript;
  theme?: RunpuyTheme;
  style?: StyleProp<TextStyle>;
};

export function RunpuyText({
  children,
  variant = 'body',
  tone = 'primary',
  script = 'latin',
  theme: themeOverride,
  style,
  ...textProps
}: RunpuyTextProps) {
  const { theme: contextTheme } = useRunpuyTheme();
  const theme = themeOverride ?? contextTheme;
  const textStyle = typography[variant];

  return (
    <Text
      {...textProps}
      style={[
        {
          color: tone === 'secondary' ? theme.colors.textSecondary : theme.colors.textPrimary,
          fontFamily: getRunpuyFontFamily(variant, script),
          fontSize: textStyle.fontSize,
          lineHeight: textStyle.lineHeight,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
