import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { studentApi } from '../api/studentApi';
import { colors, spacing, typography } from '../ui/theme';
import { Badge, Card, EmptyState, H1, P } from '../ui/components';
import { AppScreen } from '../ui/AppScreen';

export function CoursesScreen({ navigation }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await studentApi.courses();
      const list = Array.isArray(res) ? res : res?.courses || [];
      setCourses(list);
    } catch (e) {
      setError(e?.message || 'Nu pot încărca cursurile');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const items = useMemo(() => courses || [], [courses]);

  return (
    <AppScreen>
      <FlatList
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(item, idx) => String(item?.id ?? idx)}
        ListHeaderComponent={<H1 style={styles.pageTitle}>Exploreaza cursurile</H1>}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState title="Nu există cursuri" description="Când apar cursuri noi, le vei vedea aici." />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('CourseDetail', { courseId: item.id, title: item.title })}
            style={({ pressed }) => [styles.coursePressable, pressed && styles.coursePressed]}
          >
            <Card style={styles.courseCard}>
              <View style={styles.courseTop}>
                <Badge
                  tone={item?.is_active === false ? 'default' : 'success'}
                  text={item?.is_active === false ? 'Inactiv' : 'Activ'}
                />
                <Text style={styles.openText}>Deschide</Text>
              </View>
              <Text style={styles.title}>{item?.title || 'Curs'}</Text>
              {!!item?.description && <P style={{ marginTop: spacing.xs }}>{String(item.description)}</P>}
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>Profesor: {item?.teacher?.name || 'Volta Academy'}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>
                  {Array.isArray(item?.modules) ? `${item.modules.length} module` : 'Curs complet'}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
      />

      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {!!error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.x6l + spacing.lg },
  coursePressable: { marginBottom: spacing.lg },
  coursePressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  courseCard: { padding: spacing.xl + spacing.xs },
  courseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pageTitle: { marginBottom: spacing.lg },
  title: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.heavy,
    lineHeight: 25,
    letterSpacing: 0.2,
  },
  openText: { color: colors.textDisabled, fontSize: typography.size.xs, fontWeight: '700', letterSpacing: 0.3 },
  metaRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: { color: colors.textTertiary, fontSize: typography.size.xs, fontWeight: '600' },
  metaDot: { color: colors.textDisabled, fontSize: typography.size.xs },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, padding: spacing.md, alignItems: 'center' },
  errorBar: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
    backgroundColor: 'rgba(231, 76, 60, 0.14)',
    borderColor: colors.error,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: 14,
  },
  errorText: { color: colors.danger, fontWeight: '700' },
});

