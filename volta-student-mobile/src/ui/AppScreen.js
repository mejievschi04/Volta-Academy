import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TAB_BAR_BODY_CLEARANCE } from '../navigation/tabBarMetrics';
import { colors, spacing } from './theme';

export function AppScreen({
  children,
  style,
  contentStyle,
  hideTabBarInset = false,
  /** fără padding safe jos — pentru ecrane care își gestionează singuri baza (ex. chat) */
  omitBottomSafeArea = false,
}) {
  const paddingBottom = hideTabBarInset
    ? omitBottomSafeArea
      ? 0
      : spacing.lg
    : TAB_BAR_BODY_CLEARANCE;
  const edges = omitBottomSafeArea ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom'];
  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      <View style={[styles.content, { paddingBottom }, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  content: {
    flex: 1,
    paddingTop: spacing.sm,
  },
});
