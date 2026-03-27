import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { studentApi } from '../api/studentApi';
import { Badge, Card, EmptyState, LoadingBlock, P } from '../ui/components';
import { useToast } from '../ui/feedback/ToastProvider';
import { colors, radius, spacing, typography } from '../ui/theme';
import { AppScreen } from '../ui/AppScreen';

const HIDDEN_CHATS_KEY = 'volta.student.hiddenConversations';

export function MessagesScreen({ navigation }) {
  const toast = useToast();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersQuery, setUsersQuery] = useState('');

  async function load({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await studentApi.messages();
      const list = Array.isArray(res)
        ? res
        : res?.data || res?.messages || res?.threads || [];
      let hidden = [];
      try {
        const raw = await AsyncStorage.getItem(HIDDEN_CHATS_KEY);
        hidden = raw ? JSON.parse(raw) : [];
      } catch {}
      const hiddenSet = new Set((hidden || []).map((id) => String(id)));
      setThreads(list.filter((c) => !hiddenSet.has(String(c?.id))));
    } catch (e) {
      const msg = e?.message || 'Nu pot incarca mesajele';
      setError(msg);
      toast.warning(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load({ silent: true });
      const id = setInterval(() => load({ silent: true }), 9000);
      return () => clearInterval(id);
    }, [])
  );

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads || [];
    return (threads || []).filter((item) => {
      const title = String(
        item?.name || item?.title || item?.subject || item?.participant?.name || 'conversatie'
      ).toLowerCase();
      const preview = String(
        item?.lastMessage?.content || item?.last_message?.content || item?.last_message || ''
      ).toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [threads, query]);

  function formatTime(v) {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  async function loadUsers(q = '') {
    setUsersLoading(true);
    try {
      const res = await studentApi.availableMessageUsers(q);
      const list = Array.isArray(res) ? res : res?.data || [];
      setUsers(list);
    } catch (e) {
      toast.warning(e?.message || 'Nu pot incarca utilizatorii');
    } finally {
      setUsersLoading(false);
    }
  }

  async function createDirectChat(user) {
    try {
      const res = await studentApi.createDirectConversation(user?.id);
      const c = res?.data || res;
      setNewChatOpen(false);
      setUsersQuery('');
      navigation.navigate('Conversation', {
        conversationId: c?.id,
        title: user?.name || c?.participant?.name || 'Conversatie',
      });
      load({ silent: true });
    } catch (e) {
      toast.error(e?.message || 'Nu pot crea conversatia');
    }
  }

  return (
    <AppScreen>
      <FlatList
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        data={data}
        keyExtractor={(item, idx) => String(item?.id ?? idx)}
        onRefresh={load}
        refreshing={loading}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Inbox</Text>
              <Pressable
                onPress={() => {
                  setNewChatOpen(true);
                  loadUsers('');
                }}
                style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.88 }]}
              >
                <Ionicons name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cauta conversatii..."
              placeholderTextColor={colors.textDisabled}
              style={styles.search}
            />
          </View>
        }
        ListEmptyComponent={loading ? <LoadingBlock /> : <EmptyState title="Nu ai mesaje" description="Conversatiile noi vor aparea aici." />}
        renderItem={({ item }) => {
          const title =
            item?.name || item?.title || item?.subject || item?.participant?.name || 'Conversatie';
          const preview =
            item?.lastMessage?.content ||
            item?.last_message?.content ||
            item?.last_message ||
            '';
          const unread = item?.unreadCount ?? item?.unread_count ?? 0;
          const timeText = formatTime(item?.updated_at || item?.updatedAt || item?.last_message_at);
          return (
            <Pressable
              onPress={() =>
                navigation.navigate('Conversation', {
                  conversationId: item?.id,
                  title,
                  isGroup: !!item?.is_group,
                })
              }
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            >
              <Card style={styles.threadCard}>
                <View style={styles.threadHead}>
                  <View style={styles.avatarWrap}>
                    <Text style={styles.avatarText}>{title.trim().slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.threadTitle}>{title}</Text>
                    {!!preview && (
                      <Text numberOfLines={1} style={styles.previewText}>
                        {String(preview)}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                    {!!timeText && <Text style={styles.timeText}>{timeText}</Text>}
                    {!!unread && <View style={styles.unreadDot}><Text style={styles.unreadText}>{unread}</Text></View>}
                  </View>
                </View>
                {!unread && <Badge style={{ marginTop: spacing.sm }} tone="default" text="La zi" />}
              </Card>
            </Pressable>
          );
        }}
      />
      {!!error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Modal visible={newChatOpen} transparent animationType="fade" onRequestClose={() => setNewChatOpen(false)}>
        <View style={styles.modalWrap}>
          <Pressable style={styles.modalBackdrop} onPress={() => setNewChatOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Chat nou</Text>
            <TextInput
              value={usersQuery}
              onChangeText={(v) => {
                setUsersQuery(v);
                loadUsers(v);
              }}
              placeholder="Cauta utilizator..."
              placeholderTextColor={colors.textDisabled}
              style={styles.search}
            />
            {usersLoading ? (
              <LoadingBlock text="Se cauta..." />
            ) : (
              <FlatList
                data={users}
                showsVerticalScrollIndicator={false}
                keyExtractor={(item, idx) => String(item?.id ?? idx)}
                contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.md }}
                ListEmptyComponent={<EmptyState title="Niciun utilizator" description="Incearca alta cautare." />}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => createDirectChat(item)}
                    style={({ pressed }) => [styles.userRow, pressed && { opacity: 0.88 }]}
                  >
                    <View style={styles.avatarWrap}>
                      <Text style={styles.avatarText}>{String(item?.name || 'U').slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{item?.name || 'Utilizator'}</Text>
                      <Text style={styles.userEmail}>{item?.email || ''}</Text>
                    </View>
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.x6l },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  newBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSecondary,
    backgroundColor: colors.bgTertiary,
  },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderSecondary,
    borderRadius: radius.full,
    backgroundColor: colors.bgTertiary,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: typography.size.sm,
  },
  threadHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  threadCard: {
    marginBottom: spacing.smd,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandA15,
    borderWidth: 1,
    borderColor: colors.brandA30,
  },
  avatarText: { color: colors.textPrimary, fontWeight: '700' },
  threadTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  previewText: {
    marginTop: 2,
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    lineHeight: 16,
  },
  timeText: { color: colors.textDisabled, fontSize: typography.size.caption },
  unreadDot: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    backgroundColor: colors.brandPrimary,
  },
  unreadText: { color: colors.black, fontSize: typography.size.caption, fontWeight: '700' },
  modalWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  modalSheet: {
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: colors.borderSecondary,
    borderRadius: 16,
    backgroundColor: colors.bgSecondary,
    padding: spacing.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPrimary,
  },
  userName: { color: colors.textPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  userEmail: { color: colors.textDisabled, fontSize: typography.size.xs, marginTop: 1 },
  errorBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: 'rgba(243, 156, 18, 0.16)',
    borderRadius: 12,
    padding: spacing.md,
  },
  errorText: { color: colors.warning, fontWeight: '700' },
});
