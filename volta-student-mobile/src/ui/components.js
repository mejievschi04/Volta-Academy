import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, shadows, spacing, typography } from './theme';

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children, style }) {
  return (
    <Text style={[styles.h1, style]} numberOfLines={2}>
      {children}
    </Text>
  );
}

export function P({ children, style }) {
  return <Text style={[styles.p, style]}>{children}</Text>;
}

export function AppButton({ title, onPress, variant = 'primary', size = 'md', disabled, loading, style, textStyle }) {
  const btnStyle =
    variant === 'danger'
      ? styles.btnDanger
      : variant === 'ghost'
        ? styles.btnGhost
        : variant === 'secondary'
          ? styles.btnSecondary
          : styles.btnPrimary;
  const sizeStyle = size === 'sm' ? styles.btnSm : size === 'lg' ? styles.btnLg : styles.btnMd;
  const labelStyle = variant === 'ghost' ? styles.btnTextGhost : styles.btnText;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btnBase,
        sizeStyle,
        btnStyle,
        pressed && styles.btnPressed,
        (disabled || loading) && styles.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.brandPrimary : colors.black} />
      ) : (
        <Text style={[labelStyle, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Button(props) {
  return <AppButton {...props} />;
}

export function Row({ children, style }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Badge({ text, tone = 'default', style }) {
  const badgeTone = tone === 'success' ? styles.badgeSuccess : tone === 'warning' ? styles.badgeWarning : tone === 'error' ? styles.badgeError : styles.badgeDefault;
  return (
    <View style={[styles.badge, badgeTone, style]}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

export function InputField({ label, error, helper, style, inputStyle, ...props }) {
  return (
    <View style={style}>
      {!!label && <Text style={styles.inputLabel}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textDisabled}
        {...props}
        style={[styles.input, error && styles.inputError, inputStyle]}
      />
      {!!error && <Text style={styles.inputErrorText}>{error}</Text>}
      {!error && !!helper && <Text style={styles.inputHelper}>{helper}</Text>}
    </View>
  );
}

export function SectionTitle({ title, subtitle }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

export function LoadingBlock({ text = 'Se încarcă...' }) {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={colors.brandPrimary} />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  );
}

export function EmptyState({ title, description }) {
  return (
    <Card>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!description && <P style={{ marginTop: spacing.xs }}>{description}</P>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    padding: spacing.lg,
    borderRadius: radius.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  h1: {
    color: colors.textPrimary,
    fontSize: typography.size.x2l,
    fontWeight: typography.weight.heavy,
    letterSpacing: 0.3,
  },
  p: {
    color: colors.textTertiary,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  btnBase: {
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btnSm: {
    minHeight: 32,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  btnMd: {
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
  },
  btnLg: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
  },
  btnPrimary: {
    backgroundColor: colors.brandPrimary,
    ...shadows.sm,
  },
  btnSecondary: {
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.borderSecondary,
  },
  btnDanger: {
    backgroundColor: colors.error,
  },
  btnGhost: {
    backgroundColor: colors.brandA10,
    borderWidth: 1,
    borderColor: colors.brandA20,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  btnText: {
    color: colors.black,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.base,
  },
  btnTextGhost: {
    color: colors.brandPrimary,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeDefault: {
    borderColor: colors.borderSecondary,
    backgroundColor: colors.bgTertiary,
  },
  badgeSuccess: {
    borderColor: 'rgba(46, 204, 113, 0.5)',
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
  },
  badgeWarning: {
    borderColor: 'rgba(243, 156, 18, 0.5)',
    backgroundColor: 'rgba(243, 156, 18, 0.15)',
  },
  badgeError: {
    borderColor: 'rgba(231, 76, 60, 0.5)',
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
  },
  badgeText: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSecondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    backgroundColor: colors.bgTertiary,
    fontSize: typography.size.base,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputErrorText: {
    marginTop: spacing.xs,
    color: colors.error,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  inputHelper: {
    marginTop: spacing.xs,
    color: colors.textDisabled,
    fontSize: typography.size.xs,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.lg,
  },
  sectionSubtitle: {
    marginTop: spacing.xs,
    color: colors.textTertiary,
    fontSize: typography.size.sm,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  loadingText: {
    color: colors.textTertiary,
    fontSize: typography.size.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
});
