import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { studentApi } from '../api/studentApi';
import { colors, spacing } from '../ui/theme';
import { Badge, Button, Card, H1, P, Row, SectionTitle } from '../ui/components';
import { useConfirm } from '../ui/feedback/ConfirmProvider';
import { useToast } from '../ui/feedback/ToastProvider';
import { AppScreen } from '../ui/AppScreen';

export function HomeScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await studentApi.profile();
      setProfile(res);
    } catch (e) {
      const msg = e?.message || 'Nu pot încărca datele';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onLogoutPress() {
    const ok = await confirm({
      title: 'Deconectare',
      message: 'Sigur vrei să te deconectezi?',
      confirmText: 'Logout',
      cancelText: 'Rămân',
      danger: true,
    });
    if (!ok) return;
    await signOut();
    toast.info('Te-ai deconectat');
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <H1>Salut, {user?.name || 'student'}!</H1>
        <P style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>{user?.email}</P>

        <Row>
          <Button title="Cursuri" onPress={() => navigation.getParent()?.navigate('Cursuri')} />
          <Button title="Logout" variant="danger" onPress={onLogoutPress} />
        </Row>

        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle title="Progres" />
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
          ) : error ? (
            <>
              <Text style={styles.error}>{error}</Text>
              <View style={{ marginTop: spacing.md }}>
                <Button title="Reîncearcă" onPress={load} />
              </View>
            </>
          ) : (
            <>
              <P>
                Total cursuri: <Text style={styles.strong}>{profile?.stats?.totalCourses ?? '-'}</Text>
              </P>
              <P>
                Module completate: <Text style={styles.strong}>{profile?.stats?.completedModules ?? '-'}</Text> /{' '}
                <Text style={styles.strong}>{profile?.stats?.totalModules ?? '-'}</Text>
              </P>
              <P>
                Procent: <Text style={styles.strong}>{profile?.stats?.progressPercentage ?? 0}%</Text>
              </P>
              <Badge
                style={{ marginTop: spacing.md }}
                tone={(profile?.stats?.progressPercentage ?? 0) >= 70 ? 'success' : 'warning'}
                text={(profile?.stats?.progressPercentage ?? 0) >= 70 ? 'Ritm bun' : 'Continuă învățarea'}
              />
            </>
          )}
        </Card>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.x6l },
  sectionTitle: { color: colors.text, fontWeight: '800', marginBottom: spacing.sm },
  strong: { color: colors.text, fontWeight: '800' },
  error: { color: colors.danger, fontWeight: '600' },
});

