import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing, typography } from '../theme';

const ToastContext = createContext(null);
const TOAST_MS = 2800;

export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
  }, []);

  const show = useCallback((message, type = 'info') => {
    if (!message) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message: String(message), type });
    timerRef.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const api = useMemo(
    () => ({
      show,
      success: (message) => show(message, 'success'),
      warning: (message) => show(message, 'warning'),
      error: (message) => show(message, 'error'),
      info: (message) => show(message, 'info'),
      hide,
    }),
    [hide, show]
  );

  const toneStyle =
    toast?.type === 'success'
      ? styles.success
      : toast?.type === 'warning'
        ? styles.warning
        : toast?.type === 'error'
          ? styles.error
          : styles.info;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {!!toast && (
        <View pointerEvents="none" style={[styles.wrap, { top: insets.top + spacing.md }]}>
          <View style={[styles.toast, shadows.md, toneStyle]}>
            <Text style={styles.message}>{toast.message}</Text>
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
  },
  toast: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.bgElevated,
  },
  info: {
    borderColor: colors.brandA30,
    backgroundColor: colors.bgTertiary,
  },
  success: {
    borderColor: 'rgba(46, 204, 113, 0.55)',
    backgroundColor: 'rgba(46, 204, 113, 0.16)',
  },
  warning: {
    borderColor: 'rgba(243, 156, 18, 0.55)',
    backgroundColor: 'rgba(243, 156, 18, 0.16)',
  },
  error: {
    borderColor: 'rgba(231, 76, 60, 0.65)',
    backgroundColor: 'rgba(231, 76, 60, 0.16)',
  },
  message: {
    color: colors.textPrimary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: 20,
  },
});
