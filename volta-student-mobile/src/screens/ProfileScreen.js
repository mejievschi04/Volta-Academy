import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { studentApi } from '../api/studentApi';
import { Card, LoadingBlock } from '../ui/components';
import { useToast } from '../ui/feedback/ToastProvider';
import { colors, spacing, typography } from '../ui/theme';
import { AppScreen } from '../ui/AppScreen';

export function ProfileScreen() {
  const toast = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await studentApi.profile();
      setProfile(res);
    } catch (e) {
      toast.error(e?.message || 'Nu pot incarca profilul');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const profileUser = profile?.user || user || {};
  const stats = profile?.stats || {};
  const initials = useMemo(() => {
    const name = String(profileUser?.name || 'Student');
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('');
  }, [profileUser?.name]);

  const statItems = [
    {
      key: 'modules',
      icon: '📚',
      value: stats?.completedModules ?? stats?.completedLessons ?? 0,
      label: 'Module finalizate',
    },
    {
      key: 'tests',
      icon: '🎯',
      value: stats?.completedQuizzes ?? 0,
      label: 'Teste promovate',
    },
    {
      key: 'progress',
      icon: '⭐',
      value: `${stats?.progressPercentage ?? 0}%`,
      label: 'Progres general',
      progress: Math.max(0, Math.min(100, Number(stats?.progressPercentage ?? 0))),
    },
    {
      key: 'courses',
      icon: '🚀',
      value: stats?.inProgressCourses ?? 0,
      label: 'Cursuri in progres',
    },
  ];

  return (
    <AppScreen>
      <View style={styles.content}>
        {loading ? (
          <LoadingBlock />
        ) : (
          <>
            <View style={styles.headerCard}>
              <View style={styles.headerBody}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials || 'S'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{profileUser?.name || 'Student'}</Text>
                  <Text style={styles.role}>Student</Text>
                  <Text style={styles.email}>{profileUser?.email || ''}</Text>
                </View>
              </View>
            </View>

            <View style={styles.statsGrid}>
              {statItems.map((s) => (
                <View key={s.key} style={styles.statCard}>
                  <Text style={styles.statIcon}>{s.icon}</Text>
                  <Text style={styles.statValue}>{String(s.value)}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  {typeof s.progress === 'number' && (
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${s.progress}%` }]} />
                    </View>
                  )}
                </View>
              ))}
            </View>

          </>
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.x6l, gap: spacing.md },
  headerCard: {
    borderWidth: 1,
    borderColor: colors.borderSecondary,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  headerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brandPrimary,
    borderWidth: 4,
    borderColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.black,
    fontSize: typography.size.x2l,
    fontWeight: typography.weight.heavy,
  },
  name: {
    color: colors.textPrimary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.heavy,
  },
  role: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  email: {
    marginTop: spacing.xs,
    color: colors.textTertiary,
    fontSize: typography.size.xs,
  },
  statsGrid: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '48.5%',
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 16,
    backgroundColor: 'transparent',
    padding: spacing.md,
    justifyContent: 'center',
  },
  statIcon: { fontSize: 20, marginBottom: spacing.xs },
  statValue: {
    color: colors.textPrimary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.heavy,
  },
  statLabel: {
    marginTop: spacing.xs,
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  progressTrack: {
    marginTop: spacing.sm,
    width: '100%',
    height: 5,
    backgroundColor: colors.borderPrimary,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brandPrimary,
    borderRadius: 999,
  },
});
