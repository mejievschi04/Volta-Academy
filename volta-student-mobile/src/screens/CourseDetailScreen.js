import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { studentApi } from '../api/studentApi';
import { colors, spacing, typography } from '../ui/theme';
import { Badge, Button, Card, H1, P, SectionTitle } from '../ui/components';
import { AppScreen } from '../ui/AppScreen';

export function CourseDetailScreen({ navigation, route }) {
  const courseId = route?.params?.courseId;
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modulesMenuOpen, setModulesMenuOpen] = useState(false);
  const [currentLessonId, setCurrentLessonId] = useState(null);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [currentLessonLoading, setCurrentLessonLoading] = useState(false);
  const [currentLessonError, setCurrentLessonError] = useState(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await studentApi.course(courseId);
      setCourse(res);
    } catch (e) {
      setError(e?.message || 'Nu pot încărca cursul');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [courseId]);

  const modules = Array.isArray(course?.modules) ? course.modules : [];
  const summary = useMemo(() => {
    let lessonCount = 0;
    let testCount = 0;
    modules.forEach((m) => {
      const lessons = Array.isArray(m?.lessons) ? m.lessons : [];
      lessons.forEach((l) => {
        const t = String(l?.type || '').toLowerCase();
        if (t.includes('quiz') || t.includes('exam') || t.includes('test')) testCount += 1;
        else lessonCount += 1;
      });
    });
    return { lessonCount, testCount };
  }, [modules]);

  const groupedModules = useMemo(() => {
    return modules.map((m) => {
      const lessons = Array.isArray(m?.lessons) ? m.lessons : [];
      const regularLessons = lessons.filter((l) => {
        const t = String(l?.type || '').toLowerCase();
        return !(t.includes('quiz') || t.includes('exam') || t.includes('test'));
      });
      const tests = lessons.filter((l) => {
        const t = String(l?.type || '').toLowerCase();
        return t.includes('quiz') || t.includes('exam') || t.includes('test');
      });
      return { module: m, regularLessons, tests };
    });
  }, [modules]);

  const lessonSequence = useMemo(() => {
    const out = [];
    groupedModules.forEach(({ module, regularLessons, tests }) => {
      regularLessons.forEach((l) => out.push({ ...l, __moduleTitle: module?.title || 'Modul' }));
      tests.forEach((t) => out.push({ ...t, __moduleTitle: module?.title || 'Modul' }));
    });
    return out;
  }, [groupedModules]);

  const currentIndex = useMemo(
    () => lessonSequence.findIndex((l) => String(l.id) === String(currentLessonId)),
    [lessonSequence, currentLessonId]
  );

  const canPrev = currentIndex > 0;
  const canNext = currentIndex >= 0 && currentIndex < lessonSequence.length - 1;

  async function loadLesson(lessonId) {
    setCurrentLessonError(null);
    setCurrentLessonLoading(true);
    try {
      const res = await studentApi.lesson(lessonId);
      setCurrentLesson(res);
    } catch (e) {
      setCurrentLessonError(e?.message || 'Nu pot incarca lectia');
      setCurrentLesson(null);
    } finally {
      setCurrentLessonLoading(false);
    }
  }

  async function openLesson(lessonId) {
    setModulesMenuOpen(false);
    if (String(lessonId) === String(currentLessonId)) return;
    setCurrentLessonId(lessonId);
    await loadLesson(lessonId);
  }

  const firstLessonId = useMemo(() => {
    return lessonSequence.length ? lessonSequence[0].id : null;
  }, [lessonSequence]);

  const lessonTitleText = String(currentLesson?.title || 'Lectie');
  const lessonTitleFontSize =
    lessonTitleText.length > 100
      ? typography.size.base
      : lessonTitleText.length > 80
        ? typography.size.lg
        : lessonTitleText.length > 60
          ? typography.size.xl
          : typography.size.x2l;

  return (
    <AppScreen hideTabBarInset>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          !!currentLessonId && {
            paddingBottom: 52 + spacing.lg + spacing.lg,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : error ? (
          <Card>
            <Text style={styles.error}>{error}</Text>
            <View style={{ marginTop: spacing.md }}>
              <Button title="Reîncearcă" onPress={load} />
            </View>
          </Card>
        ) : (
          <>
            <View style={styles.topRow}>
              <Pressable
                onPress={() => setModulesMenuOpen(true)}
                style={({ pressed }) => [styles.modulesBtn, pressed && { opacity: 0.88 }]}
              >
                <Ionicons name="menu" size={20} color={colors.textSecondary} />
              </Pressable>
              {!!currentLessonId && (
                <Pressable
                  onPress={() => {
                    setModulesMenuOpen(false);
                    setCurrentLessonId(null);
                    setCurrentLesson(null);
                    setCurrentLessonError(null);
                    navigation.goBack();
                  }}
                  style={({ pressed }) => [styles.exitBtn, pressed && { opacity: 0.88 }]}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
            {currentLessonId ? (
              <Text style={[styles.lessonMainTitle, { fontSize: lessonTitleFontSize }]}>{lessonTitleText}</Text>
            ) : (
              <H1>{course?.title || 'Curs'}</H1>
            )}
            {!currentLessonId && !!course?.description && (
              <P style={{ marginTop: spacing.sm }}>{String(course.description)}</P>
            )}
            {!currentLessonId && <P style={{ marginTop: spacing.sm, color: colors.textDisabled }}>{modules.length} module · {summary.lessonCount} lectii · {summary.testCount} teste</P>}

            <View style={styles.startWrap}>
              {!currentLessonId ? (
                <>
                  <Button
                    title="Incepe"
                    onPress={() => firstLessonId && openLesson(firstLessonId)}
                    disabled={!firstLessonId}
                  />
                  {!firstLessonId && (
                    <Text style={styles.startHint}>Acest curs nu are inca lectii disponibile.</Text>
                  )}
                </>
              ) : (
                <Card style={styles.lessonViewer}>
                  <SectionTitle
                    title="Continut lectie"
                    subtitle={
                      currentIndex >= 0
                        ? `${currentIndex + 1} / ${lessonSequence.length} · ${
                            lessonSequence[currentIndex]?.__moduleTitle || 'Modul'
                          }`
                        : undefined
                    }
                  />
                  {!!currentLessonLoading && !currentLessonId && (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
                  )}
                  {!!currentLessonError && (
                    <Text style={[styles.startHint, { color: colors.error, marginTop: spacing.md }]}>
                      {currentLessonError}
                    </Text>
                  )}
                  {!currentLessonLoading && !currentLessonError && (
                    <P style={{ marginTop: spacing.md }}>
                      {currentLesson?.content
                        ? String(currentLesson.content)
                        : 'Continut indisponibil pentru aceasta lectie.'}
                    </P>
                  )}
                </Card>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={modulesMenuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModulesMenuOpen(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.drawer}>
            <Text style={styles.drawerTitle}>Module</Text>
            <ScrollView contentContainerStyle={styles.drawerContent}>
              {groupedModules.length === 0 ? (
                <Text style={styles.drawerEmpty}>Nu există module.</Text>
              ) : (
                groupedModules.map(({ module, regularLessons, tests }) => (
                  <View key={String(module?.id)} style={styles.drawerModule}>
                    <View style={styles.moduleHead}>
                      <Text style={styles.moduleTitle}>{module?.title || `Modul #${module?.id}`}</Text>
                      <Badge text={`Ordine ${module?.order ?? '-'}`} />
                    </View>

                    {regularLessons.map((l) => (
                      <Pressable
                        key={String(l.id)}
                        onPress={() => openLesson(l.id)}
                        style={({ pressed }) => [styles.lessonRow, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={styles.lessonTitle}>{l.title || `Lecție #${l.id}`}</Text>
                      </Pressable>
                    ))}

                    {tests.length > 0 && (
                      <View style={styles.testsBlock}>
                        <Text style={styles.testsTitle}>Teste</Text>
                        {tests.map((t) => (
                          <Pressable
                            key={String(t.id)}
                            onPress={() => openLesson(t.id)}
                            style={({ pressed }) => [styles.testRow, pressed && { opacity: 0.92 }]}
                          >
                            <Badge tone="default" text="Test" />
                            <Text style={styles.testTitle}>{t.title || `Test #${t.id}`}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
          <Pressable style={styles.backdrop} onPress={() => setModulesMenuOpen(false)} />
        </View>
      </Modal>

      {!!currentLessonId && (
        <View style={[styles.bottomNav, { bottom: spacing.lg }]}>
          <TouchableOpacity
            onPress={() => canPrev && openLesson(lessonSequence[currentIndex - 1].id)}
            disabled={!canPrev || currentLessonLoading}
            activeOpacity={0.85}
            style={[styles.arrowBtn, (!canPrev || currentLessonLoading) && styles.arrowDisabled]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => canNext && openLesson(lessonSequence[currentIndex + 1].id)}
            disabled={!canNext || currentLessonLoading}
            activeOpacity={0.85}
            style={[styles.arrowBtn, (!canNext || currentLessonLoading) && styles.arrowDisabled]}
          >
            <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.lg, paddingBottom: spacing.x6l + spacing.lg },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modulesBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'transparent',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'transparent',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startWrap: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  lessonViewer: {
    marginTop: spacing.xs,
    padding: spacing.xl,
  },
  arrowBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: {
    alignSelf: 'flex-start',
  },
  arrowRight: {
    alignSelf: 'flex-end',
  },
  arrowDisabled: {
    opacity: 0.35,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  startHint: {
    color: colors.textDisabled,
    fontSize: typography.size.xs,
  },
  lessonMainTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weight.heavy,
    lineHeight: 34,
    letterSpacing: 0.2,
  },
  sectionTitle: { color: colors.text, fontWeight: '800', marginBottom: spacing.sm },
  module: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  moduleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  moduleTitle: { color: colors.text, fontWeight: '800' },
  lessonRow: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'transparent',
  },
  lessonTitle: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    lineHeight: 20,
  },
  lessonMeta: { color: colors.muted, marginTop: 2, fontSize: typography.size.xs },
  testsBlock: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: spacing.md,
  },
  testsTitle: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  testRow: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  testTitle: { color: colors.textPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold, flex: 1 },
  modalWrap: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawer: {
    width: '84%',
    maxWidth: 360,
    backgroundColor: colors.bgSecondary,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  drawerTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.heavy,
    marginBottom: spacing.md,
  },
  drawerContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  drawerModule: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: 'transparent',
    gap: spacing.sm,
  },
  drawerEmpty: {
    color: colors.textDisabled,
    fontSize: typography.size.sm,
  },
  error: { color: colors.danger, fontWeight: '700' },
});

