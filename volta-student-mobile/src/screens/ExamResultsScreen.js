import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { studentApi } from '../api/studentApi';
import { Badge, Card, EmptyState, LoadingBlock, P } from '../ui/components';
import { useToast } from '../ui/feedback/ToastProvider';
import { colors, spacing } from '../ui/theme';
import { AppScreen } from '../ui/AppScreen';

export function ExamResultsScreen() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await studentApi.examResults();
      setItems(Array.isArray(res) ? res : res?.results || res?.examResults || []);
    } catch (e) {
      toast.warning(e?.message || 'Nu pot incarca rezultatele examenelor');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const data = useMemo(() => items || [], [items]);

  return (
    <AppScreen>
      <FlatList
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(item, idx) => String(item?.id ?? idx)}
        onRefresh={load}
        refreshing={loading}
        ListHeaderComponent={<Text style={styles.title}>Rezultate examene</Text>}
        ListEmptyComponent={loading ? <LoadingBlock /> : <EmptyState title="Niciun rezultat disponibil" description="Dupa primele evaluari vor aparea aici." />}
        renderItem={({ item }) => {
          const score = Number(item?.score ?? item?.percentage ?? 0);
          return (
            <Card style={{ marginBottom: spacing.md, padding: spacing.xl }}>
              <Text style={styles.itemTitle}>{item?.exam_title || item?.title || 'Examen'}</Text>
              <P style={{ marginTop: spacing.xs }}>Scor: {Number.isFinite(score) ? `${score}%` : '-'}</P>
              <Badge style={{ marginTop: spacing.sm }} tone={score >= 70 ? 'success' : 'warning'} text={score >= 70 ? 'Promovat' : 'In progres'} />
            </Card>
          );
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.x6l },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: spacing.md },
  itemTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
});
