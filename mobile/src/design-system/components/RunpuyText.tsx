import type { ComponentProps, ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { lightTheme, type RunpuyTheme } from '../themes';
import { typography } from '../typography';

export type RunpuyTextVariant = keyof typeof typography;
export type RunpuyTextTone = 'primary' | 'secondary';

export type RunpuyTextProps = Omit<ComponentProps<typeof Text>, 'style' | 'children'> & {
  children: ReactNode;
  variant?: RunpuyTextVariant;
  tone?: RunpuyTextTone;
  theme?: RunpuyTheme;
  style?: StyleProp<TextStyle>;
};

function resolveFontWeight(weight: number): TextStyle['fontWeight'] | undefined {
  // RUNPUY's exact 650 weight is deferred until its custom fonts are loaded.
  if (weight === 650) {
    return undefined;
  }

  return String(weight) as TextStyle['fontWeight'];
}

export function RunpuyText({
  children,
  variant = 'body',
  tone = 'primary',
  theme = lightTheme,
  style,
  ...textProps
}: RunpuyTextProps) {
  const textStyle = typography[variant];

  return (
    <Text
      {...textProps}
      style={[
        {
          color: tone === 'secondary' ? theme.colors.textSecondary : theme.colors.textPrimary,
          fontSize: textStyle.fontSize,
          lineHeight: textStyle.lineHeight,
          fontWeight: resolveFontWeight(textStyle.weight),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
