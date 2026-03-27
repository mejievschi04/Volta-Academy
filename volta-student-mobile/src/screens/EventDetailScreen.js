import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { studentApi } from '../api/studentApi';
import { Badge, Button, Card, LoadingBlock, P, SectionTitle } from '../ui/components';
import { useToast } from '../ui/feedback/ToastProvider';
import { colors, spacing } from '../ui/theme';
import { AppScreen } from '../ui/AppScreen';

export function EventDetailScreen({ route }) {
  const toast = useToast();
  const eventId = route?.params?.eventId;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await studentApi.event(eventId);
      setEvent(res?.event || res);
    } catch (e) {
      const msg = e?.message || 'Nu pot incarca detaliile evenimentului';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [eventId]);

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <Card>
            <Text style={styles.error}>{error}</Text>
            <View style={{ marginTop: spacing.md }}>
              <Button title="Reincearca" onPress={load} />
            </View>
          </Card>
        ) : (
          <>
            <Text style={styles.title}>{event?.title || 'Eveniment'}</Text>
            <Badge
              style={{ marginTop: spacing.sm }}
              tone={event?.is_live ? 'success' : 'default'}
              text={event?.is_live ? 'Live acum' : event?.starts_at ? String(event.starts_at) : 'Programat'}
            />
            <Card style={{ marginTop: spacing.lg, padding: spacing.xl }}>
              <SectionTitle title="Descriere" />
              <P style={{ marginTop: spacing.sm }}>
                {event?.description ? String(event.description) : 'Descriere indisponibila.'}
              </P>
            </Card>
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.x6l },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
  error: { color: colors.error, fontWeight: '700' },
});
