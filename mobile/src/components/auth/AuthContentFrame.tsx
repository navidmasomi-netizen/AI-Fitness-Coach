import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../design-system/tokens';

type AuthContentFrameProps = {
  header: ReactNode;
  children: ReactNode;
};

/** Shared auth composition: a stable header anchor with a responsive body region. */
export function AuthContentFrame({ header, children }: AuthContentFrameProps) {
  return (
    <View style={styles.frame}>
      {header}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flexGrow: 1,
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: spacing['2xl'],
    paddingTop: spacing.xl,
  },
});
