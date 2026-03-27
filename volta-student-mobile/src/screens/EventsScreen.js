import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { studentApi } from '../api/studentApi';
import { Badge, Card, EmptyState, LoadingBlock, P } from '../ui/components';
import { useToast } from '../ui/feedback/ToastProvider';
import { colors, spacing } from '../ui/theme';
import { AppScreen } from '../ui/AppScreen';

export function EventsScreen({ navigation }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await studentApi.events();
      const list = Array.isArray(res) ? res : res?.events || res?.data || [];
      setItems(list);
    } catch (e) {
      const msg = e?.message || 'Nu pot incarca evenimentele';
      setError(msg);
      toast.error(msg);
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
        ListHeaderComponent={<Text style={styles.title}>Calendar Evenimente</Text>}
        ListEmptyComponent={loading ? <LoadingBlock text="Se incarca..." /> : <EmptyState title="Nu exista evenimente" description="Cand apar, le vei gasi aici." />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('EventDetail', { eventId: item?.id, title: item?.title })}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <Card style={{ marginBottom: spacing.md, padding: spacing.xl }}>
              <Text style={styles.itemTitle}>{item?.title || 'Eveniment'}</Text>
              {!!item?.description && <P style={{ marginTop: spacing.xs }}>{String(item.description)}</P>}
              <Badge
                style={{ marginTop: spacing.sm }}
                tone={item?.is_live ? 'success' : 'default'}
                text={item?.is_live ? 'Live' : item?.starts_at ? String(item.starts_at) : 'Programat'}
              />
            </Card>
          </Pressable>
        )}
      />
      {!!error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.x6l },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: spacing.md },
  itemTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  errorBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.4)',
    backgroundColor: 'rgba(231, 76, 60, 0.12)',
    borderRadius: 12,
    padding: spacing.md,
  },
  errorText: { color: colors.error, fontWeight: '700' },
});
