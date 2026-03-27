import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { AppButton } from '../components';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirmă',
    cancelText: 'Anulează',
    danger: false,
    onConfirm: null,
    onCancel: null,
  });

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false, onConfirm: null, onCancel: null }));
  }, []);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: options?.title || 'Confirmare',
        message: options?.message || '',
        confirmText: options?.confirmText || 'Confirmă',
        cancelText: options?.cancelText || 'Anulează',
        danger: !!options?.danger,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, []);

  const onCancel = () => {
    const cb = state.onCancel;
    close();
    if (cb) cb();
  };

  const onConfirm = () => {
    const cb = state.onConfirm;
    close();
    if (cb) cb();
  };

  const api = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Modal visible={state.open} transparent animationType="fade" onRequestClose={onCancel}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
          <View style={[styles.sheet, shadows.lg]}>
            <Text style={styles.title}>{state.title}</Text>
            {!!state.message && <Text style={styles.message}>{state.message}</Text>}
            <View style={styles.actions}>
              <AppButton title={state.cancelText} variant="secondary" onPress={onCancel} style={styles.actionBtn} />
              <AppButton
                title={state.confirmText}
                variant={state.danger ? 'danger' : 'primary'}
                onPress={onConfirm}
                style={styles.actionBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSecondary,
    backgroundColor: colors.bgSecondary,
    padding: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  message: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  actions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
