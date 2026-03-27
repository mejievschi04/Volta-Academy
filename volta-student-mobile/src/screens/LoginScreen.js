import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { API_URL, isAndroidEmulatorLoopbackApiUrl } from '../config';
import { pingLaravelServer } from '../api/serverHealth';
import { useToast } from '../ui/feedback/ToastProvider';
import { colors, radius, spacing } from '../ui/theme';

export function LoginScreen() {
  const { signIn } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signIn({ email: email.trim(), password });
      toast.success('Autentificare reușită');
    } catch (e) {
      const msg = e?.message || 'Autentificare eșuată';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onCheckServer() {
    setCheckResult(null);
    setCheckLoading(true);
    try {
      const r = await pingLaravelServer(20000);
      if (r.ok) {
        setCheckResult({ ok: true, text: `Server OK (${r.status})` });
        toast.success('Conexiune server OK');
      } else {
        const tried = r.url ? `\nÎncercat: ${r.url}` : '';
        toast.warning('Serverul nu a răspuns în timpul așteptat');
        setCheckResult({
          ok: false,
          text: r.aborted
            ? `Nu răspunde la timp (20s).${tried}\nBackend: php artisan serve --host=0.0.0.0 --port=8000\nWindows: permite portul 8000 în firewall pentru rețea privată.`
            : `Fără răspuns: ${r.message || 'rețea'}${tried}`,
        });
      }
    } finally {
      setCheckLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      {/* Fără expo-linear-gradient: evită eroarea când dev build-ul nu are modulul nativ */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.bgStripes]}>
        <View style={[styles.bgStripe, { backgroundColor: colors.bgPrimary }]} />
        <View style={[styles.bgStripe, { backgroundColor: '#181818' }]} />
        <View style={[styles.bgStripe, { backgroundColor: colors.bgSecondary }]} />
        <View style={[styles.bgStripe, { backgroundColor: colors.bgPrimary }]} />
      </View>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.accentBar} />

            <View style={styles.brand}>
              <View style={styles.logoWrap}>
                <Image source={require('../../assets/volta-logo.png')} style={styles.logo} resizeMode="contain" />
              </View>
              <Text style={styles.title}>Volta Academy</Text>
              <Text style={styles.subtitle}>Student</Text>
            </View>

            <Text style={styles.tagline}>Intră cu contul tău de pe platforma web.</Text>

            <View style={styles.card}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="nume@exemplu.com"
                placeholderTextColor={colors.textDisabled}
                style={styles.input}
              />

              <Text style={[styles.label, styles.labelSpaced]}>Parolă</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={colors.textDisabled}
                style={styles.input}
              />

              {!!error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                onPress={onSubmit}
                disabled={loading}
                style={({ pressed }) => [
                  styles.submit,
                  pressed && styles.submitPressed,
                  loading && styles.submitDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.black} />
                ) : (
                  <Text style={styles.submitText}>Conectează-te</Text>
                )}
              </Pressable>
            </View>

            {__DEV__ && (
              <View style={styles.devBox}>
                <Text style={styles.devTitle}>Conexiune (dev)</Text>
                <Text style={styles.devUrl} selectable>
                  {API_URL}
                </Text>
                <Pressable
                  onPress={onCheckServer}
                  disabled={checkLoading}
                  style={({ pressed }) => [styles.checkBtn, pressed && { opacity: 0.85 }]}
                >
                  {checkLoading ? (
                    <ActivityIndicator color={colors.brandPrimary} size="small" />
                  ) : (
                    <Text style={styles.checkBtnText}>Verifică serverul (/up)</Text>
                  )}
                </Pressable>
                {checkResult && (
                  <Text
                    style={[styles.checkResult, checkResult.ok ? styles.checkOk : styles.checkFail]}
                  >
                    {checkResult.text}
                  </Text>
                )}
                {isAndroidEmulatorLoopbackApiUrl() ? (
                  <Text style={styles.devWarn}>
                    Ești pe telefon fizic? 10.0.2.2 e doar pentru emulator. Pornește Metro cu LAN
                    (nu tunnel), sau setează în PowerShell înainte de expo:{' '}
                    <Text style={styles.devMono}>$env:EXPO_PUBLIC_API_URL=&quot;http://IP_PC:8000/api&quot;</Text>
                    (IP din ipconfig, același Wi‑Fi ca telefonul).
                  </Text>
                ) : null}
                <Text style={styles.devHint}>
                  Android + HTTP local: cleartext e activat în manifest. Backend:{' '}
                  <Text style={styles.devMono}>serve --host=0.0.0.0</Text>
                </Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  bgStripes: { flexDirection: 'column' },
  bgStripe: { flex: 1 },
  flex: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
  },
  accentBar: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brandPrimary,
    marginBottom: spacing.xl,
    opacity: 0.95,
  },
  brand: { alignItems: 'center', marginBottom: spacing.lg },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.xxl,
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.borderSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  logo: { width: 56, height: 56 },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.brandPrimary,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  tagline: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSecondary,
    padding: spacing.xl,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  labelSpaced: { marginTop: spacing.lg },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSecondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.bgTertiary,
  },
  error: {
    marginTop: spacing.lg,
    color: colors.error,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  submit: {
    marginTop: spacing.xl,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.xl,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitPressed: { backgroundColor: colors.brandHover },
  submitDisabled: { opacity: 0.6 },
  submitText: {
    color: colors.black,
    fontSize: 17,
    fontWeight: '800',
  },
  devBox: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(42,42,42,0.6)',
    borderWidth: 1,
    borderColor: colors.borderPrimary,
  },
  devTitle: { color: colors.textTertiary, fontSize: 12, fontWeight: '700', marginBottom: spacing.sm },
  devUrl: { color: colors.brandSoft, fontSize: 11, marginBottom: spacing.md },
  checkBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    marginBottom: spacing.sm,
  },
  checkBtnText: { color: colors.brandPrimary, fontWeight: '700', fontSize: 14 },
  checkResult: { fontSize: 13, marginTop: spacing.xs, lineHeight: 18 },
  checkOk: { color: colors.success },
  checkFail: { color: colors.warning },
  devWarn: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  devHint: { marginTop: spacing.md, color: colors.textDisabled, fontSize: 11, lineHeight: 16 },
  devMono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.textTertiary },
});
