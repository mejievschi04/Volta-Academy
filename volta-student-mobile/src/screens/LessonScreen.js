import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { studentApi } from '../api/studentApi';
import { colors, spacing, typography } from '../ui/theme';
import { Badge, Button, Card, H1, P, Row, SectionTitle } from '../ui/components';
import { AppScreen } from '../ui/AppScreen';

export function LessonScreen({ route }) {
  const lessonId = route?.params?.lessonId;
  const [lesson, setLesson] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      // Access check is protected (auth). Lesson itself is public in API routes.
      const [a, l] = await Promise.allSettled([studentApi.checkLessonAccess(lessonId), studentApi.lesson(lessonId)]);
      setAccess(a.status === 'fulfilled' ? a.value : null);
      if (l.status === 'fulfilled') setLesson(l.value);
      if (l.status === 'rejected' && a.status === 'rejected') throw l.reason;
    } catch (e) {
      setError(e?.message || 'Nu pot încărca lecția');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [lessonId]);

  const canAccess = access ? (access?.can_access ?? access?.allowed ?? true) : true;
  const lessonType = String(lesson?.type || '').toLowerCase();
  const isTestLesson =
    lessonType.includes('quiz') || lessonType.includes('exam') || lessonType.includes('test');

  async function onComplete() {
    setError(null);
    try {
      await studentApi.completeLesson(lessonId);
      await load();
    } catch (e) {
      setError(e?.message || 'Nu pot marca lecția ca finalizată');
    }
  }

  return (
    <AppScreen hideTabBarInset>
      <ScrollView contentContainerStyle={styles.content}>
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
            <H1>{lesson?.title || `Lecție #${lessonId}`}</H1>
            {!!lesson?.type && <P style={{ marginTop: spacing.xs }}>Tip: {String(lesson.type)}</P>}
            {!!lesson?.type && (
              <Badge
                style={{ marginTop: spacing.sm }}
                tone="default"
                text={String(lesson.type)}
              />
            )}

            {access && !canAccess ? (
              <Card style={{ marginTop: spacing.lg }}>
                <Text style={styles.error}>Lecția este blocată.</Text>
                {!!access?.message && <P style={{ marginTop: spacing.sm }}>{String(access.message)}</P>}
              </Card>
            ) : (
              <>
                <Card style={{ marginTop: spacing.lg, padding: spacing.xl }}>
                  <SectionTitle title={isTestLesson ? 'Detalii test' : 'Conținut'} />
                  {lesson?.content ? <P>{String(lesson.content)}</P> : <P>Conținutul lecției nu e disponibil în acest răspuns.</P>}
                </Card>

                <Row style={{ marginTop: spacing.lg }}>
                  <Button
                    title={isTestLesson ? 'Finalizeaza testul' : 'Marchează complet'}
                    variant={isTestLesson ? 'secondary' : 'primary'}
                    onPress={onComplete}
                  />
                </Row>
              </>
            )}
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  sectionTitle: { color: colors.text, fontWeight: typography.weight.heavy, marginBottom: spacing.sm },
  error: { color: colors.danger, fontWeight: typography.weight.bold, fontSize: typography.size.sm, lineHeight: 20 },
});

