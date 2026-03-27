import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { studentApi } from '../api/studentApi';
import { Badge, Card, EmptyState, LoadingBlock, P } from '../ui/components';
import { useToast } from '../ui/feedback/ToastProvider';
import { colors, spacing } from '../ui/theme';
import { AppScreen } from '../ui/AppScreen';

export function AchievementsScreen() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await studentApi.achievements();
      setItems(Array.isArray(res) ? res : res?.achievements || res?.data || []);
    } catch (e) {
      toast.warning(e?.message || 'Nu pot incarca realizarile');
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
        ListHeaderComponent={<Text style={styles.title}>Realizari</Text>}
        ListEmptyComponent={loading ? <LoadingBlock /> : <EmptyState title="Fara realizari momentan" description="Continua cursurile pentru a debloca noi realizari." />}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.md, padding: spacing.xl }}>
            <Text style={styles.itemTitle}>{item?.title || item?.name || 'Realizare'}</Text>
            {!!item?.description && <P style={{ marginTop: spacing.xs }}>{String(item.description)}</P>}
            <Badge style={{ marginTop: spacing.sm }} tone="success" text="Deblocat" />
          </Card>
        )}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.x6l },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: spacing.md },
  itemTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
});
