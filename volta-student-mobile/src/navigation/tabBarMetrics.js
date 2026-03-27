import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Marjă între marginea safe și bara de tab-uri flotantă. */
export const TAB_BAR_FLOAT_BOTTOM = Platform.OS === 'ios' ? 20 : 12;
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 84 : 68;

const TAB_BAR_GAP = 8;

/**
 * Spațiu pentru bara de tab-uri (fără insets).
 * Folosit în layout după ce SafeAreaView aplică deja marginea de jos (bara Android / home indicator).
 */
export const TAB_BAR_BODY_CLEARANCE = TAB_BAR_FLOAT_BOTTOM + TAB_BAR_HEIGHT + TAB_BAR_GAP;

/**
 * Poziție față de baza ecranului fizic pentru bara de tab-uri (AppTabs).
 */
export function useTabBarAbsoluteBottom() {
  const insets = useSafeAreaInsets();
  return useMemo(() => TAB_BAR_FLOAT_BOTTOM + insets.bottom, [insets.bottom]);
}
