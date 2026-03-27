import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { AuthStack } from './src/navigation/AuthStack';
import { AppTabs } from './src/navigation/AppTabs';
import { ConfirmProvider } from './src/ui/feedback/ConfirmProvider';
import { ToastProvider } from './src/ui/feedback/ToastProvider';
import { colors } from './src/ui/theme';

enableScreens(true);

function AppNavigation() {
  const { bootstrapped, user } = useAuth();

  if (!bootstrapped) {
    return (
      <SafeAreaView style={styles.splash} edges={['top', 'left', 'right', 'bottom']}>
        <Image source={require('./assets/volta-logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Volta Academy</Text>
        <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
        <Text style={styles.hint}>Se încarcă…</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <NavigationContainer>
        {user ? <AppTabs /> : <AuthStack />}
      </NavigationContainer>
      <StatusBar style="light" />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <AppNavigation />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: { width: 80, height: 80, marginBottom: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 24 },
  spinner: { marginBottom: 12 },
  hint: { color: colors.muted, fontSize: 14 },
});
