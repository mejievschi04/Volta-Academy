import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { studentApi } from '../api/studentApi';
import { Card, LoadingBlock } from '../ui/components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../ui/feedback/ToastProvider';
import { colors, radius, shadows, spacing, typography } from '../ui/theme';
import { AppScreen } from '../ui/AppScreen';
import { TAB_BAR_HEIGHT, useTabBarAbsoluteBottom } from '../navigation/tabBarMetrics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HIDDEN_CHATS_KEY = 'volta.student.hiddenConversations';

export function ConversationScreen({ navigation, route }) {
  const toast = useToast();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const conversationId = route?.params?.conversationId;
  const isGroup = !!route?.params?.isGroup;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendState, setSendState] = useState('');
  const listRef = useRef(null);

  function normalizeMessages(list) {
    const map = new Map();
    (list || []).forEach((m, idx) => {
      const id = String(m?.id ?? `temp-${idx}-${m?.created_at || Date.now()}`);
      map.set(id, m);
    });
    return Array.from(map.values());
  }

  async function load({ silent = false } = {}) {
    setLoading(messages.length === 0);
    try {
      const res = await studentApi.conversationMessages(conversationId);
      const list = Array.isArray(res) ? res : res?.data || res?.messages || [];
      setMessages((prev) => {
        if (!silent || prev.length === 0) return normalizeMessages(list);
        return normalizeMessages([...prev.filter((m) => String(m?.id || '').startsWith('temp-')), ...list]);
      });
      try {
        await studentApi.markConversationRead(conversationId);
      } catch {}
    } catch (e) {
      toast.error(e?.message || 'Nu pot incarca conversatia');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      load({ silent: true });
      const id = setInterval(() => load({ silent: true }), 7000);
      return () => {
        clearInterval(id);
        Keyboard.dismiss();
      };
    }, [conversationId])
  );

  const data = useMemo(() => messages || [], [messages]);

  const listWithDateSeparators = useMemo(() => {
    const out = [];
    let lastKey = '';
    for (const m of data) {
      const d = new Date(m?.created_at || m?.createdAt || Date.now());
      const key = Number.isNaN(d.getTime()) ? 'unknown' : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (key !== lastKey) {
        out.push({
          _type: 'separator',
          _id: `sep-${key}-${out.length}`,
          _date: d,
        });
        lastKey = key;
      }
      out.push({ ...m, _type: 'message', _id: String(m?.id ?? `tmp-${out.length}`) });
    }
    return out;
  }, [data]);

  function formatTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function formatDayLabel(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    const yKey = `${y.getFullYear()}-${y.getMonth()}-${y.getDate()}`;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key === todayKey) return 'Azi';
    if (key === yKey) return 'Ieri';
    return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  async function onSend() {
    const content = text.trim();
    if (!content) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      content,
      mine: true,
      created_at: new Date().toISOString(),
      sender_name: 'Tu',
      _pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 60);
    setSending(true);
    setSendState('Se trimite...');
    try {
      const res = await studentApi.sendConversationMessage(conversationId, content);
      const msg = res?.data || res?.message || res;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
      setSendState('Trimis');
      setTimeout(() => setSendState(''), 1200);
    } catch (e) {
      toast.error(e?.message || 'Nu pot trimite mesajul');
      setSendState('Eroare');
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _pending: false, _failed: true } : m)));
    } finally {
      setSending(false);
    }
  }

  async function onDeleteChat() {
    Alert.alert(
      isGroup ? 'Parasesti grupul?' : 'Stergi chatul?',
      isGroup
        ? 'Vei parasi acest grup.'
        : 'Conversatia va fi ascunsa din inbox pe acest dispozitiv.',
      [
        { text: 'Anuleaza', style: 'cancel' },
        {
          text: isGroup ? 'Paraseste' : 'Sterge',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isGroup) {
                await studentApi.leaveGroupConversation(conversationId);
              } else {
                const raw = (await AsyncStorage.getItem(HIDDEN_CHATS_KEY)) || '[]';
                const arr = JSON.parse(raw);
                const next = Array.from(new Set([...(Array.isArray(arr) ? arr : []), String(conversationId)]));
                await AsyncStorage.setItem(HIDDEN_CHATS_KEY, JSON.stringify(next));
              }
              toast.success(isGroup ? 'Ai parasit grupul' : 'Chat sters din inbox');
              navigation.goBack();
            } catch (e) {
              toast.error(e?.message || 'Nu pot sterge chatul');
            }
          },
        },
      ]
    );
  }

  const tabBarBottom = useTabBarAbsoluteBottom();
  /** Spațiu sub mesaje ca să nu stea sub bara de compunere (ancorată ca bara de tab-uri). */
  const listBottomPad = tabBarBottom + TAB_BAR_HEIGHT + spacing.lg;

  return (
    <AppScreen hideTabBarInset omitBottomSafeArea contentStyle={{ paddingBottom: 0 }}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
        <View style={styles.chatHeader}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={8}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>
              {String(route?.params?.title || 'C').trim().slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.chatTitle}>{route?.params?.title || 'Conversatie'}</Text>
            <Text style={styles.chatSubtitle}>Activ acum</Text>
          </View>
          <Pressable
            onPress={onDeleteChat}
            hitSlop={8}
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="trash-outline" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>
        {loading ? (
          <View style={[styles.listFlex, { paddingBottom: listBottomPad }]}>
            <LoadingBlock />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.listFlex}
            contentContainerStyle={[styles.list, { paddingBottom: listBottomPad }]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            data={listWithDateSeparators}
            keyExtractor={(item, idx) => String(item?._id ?? item?.id ?? idx)}
            renderItem={({ item }) => {
              if (item?._type === 'separator') {
                return (
                  <View style={styles.separatorWrap}>
                    <View style={styles.separatorLine} />
                    <Text style={styles.separatorText}>{formatDayLabel(item?._date)}</Text>
                    <View style={styles.separatorLine} />
                  </View>
                );
              }
              const mine =
                !!item?.mine ||
                !!item?.isMine ||
                !!item?.is_mine ||
                (user?.id != null && String(item?.sender_id) === String(user.id));
              const content = item?.content || item?.message || '';
              const senderName =
                item?.sender?.name ||
                item?.sender_name ||
                item?.senderName ||
                (mine ? 'Tu' : 'Participant');
              const timeText = formatTime(item?.created_at || item?.createdAt);
              return (
                <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
                  <Card style={[styles.bubble, mine ? styles.mine : styles.other]}>
                    <View style={styles.metaRow}>
                      {!!isGroup && (
                        <Text style={[styles.senderName, mine && styles.senderMine]}>
                          {mine ? 'Tu' : senderName}
                        </Text>
                      )}
                      {!!timeText && <Text style={styles.timeText}>{timeText}</Text>}
                    </View>
                    <Text style={styles.messageText}>{String(content)}</Text>
                    {!!item?._pending && <Text style={styles.statusText}>Se trimite...</Text>}
                    {!!item?._failed && <Text style={[styles.statusText, { color: colors.error }]}>Eroare la trimitere</Text>}
                  </Card>
                </View>
              );
            }}
          />
        )}

        <View style={[styles.composer, { bottom: tabBarBottom }]}>
          <View style={styles.composerRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Scrie un mesaj..."
              placeholderTextColor={colors.textDisabled}
              style={styles.input}
              multiline
            />
            <Pressable
              onPress={onSend}
              disabled={sending || !text.trim()}
              style={({ pressed }) => [
                styles.sendIconBtn,
                (sending || !text.trim()) && styles.sendIconBtnDisabled,
                pressed && { opacity: 0.88 },
              ]}
            >
              <Ionicons name="send" size={18} color={colors.black} />
            </Pressable>
          </View>
          {!!sendState && <Text style={styles.sendState}>{sendState}</Text>}
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  backBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  deleteBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandA15,
    borderWidth: 1,
    borderColor: colors.brandA30,
  },
  avatarText: { color: colors.textPrimary, fontSize: typography.size.base, fontWeight: typography.weight.bold },
  chatTitle: { color: colors.textPrimary, fontSize: typography.size.base, fontWeight: typography.weight.bold },
  chatSubtitle: { color: colors.textDisabled, fontSize: typography.size.xs, marginTop: 1 },
  listFlex: { flex: 1 },
  list: { paddingTop: spacing.xs, paddingHorizontal: spacing.xl },
  separatorWrap: {
    marginVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderPrimary,
  },
  separatorText: {
    color: colors.textDisabled,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  row: { marginBottom: spacing.sm, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 18 },
  mine: { borderColor: colors.brandA30, backgroundColor: colors.brandA15 },
  other: { borderColor: colors.borderPrimary },
  messageText: { color: colors.textPrimary, fontSize: typography.size.sm, lineHeight: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: spacing.sm,
  },
  senderName: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  senderMine: { color: colors.brandSoft },
  timeText: {
    color: colors.textDisabled,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.medium,
  },
  composer: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    backgroundColor: colors.bgSecondary,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.xxl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    zIndex: 2,
    ...shadows.md,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderSecondary,
    borderRadius: radius.full,
    backgroundColor: colors.bgTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: typography.size.sm,
  },
  sendIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandPrimary,
  },
  sendIconBtnDisabled: {
    opacity: 0.45,
  },
  sendState: {
    color: colors.textDisabled,
    fontSize: typography.size.xs,
    marginTop: 2,
  },
  statusText: {
    marginTop: 4,
    color: colors.textDisabled,
    fontSize: typography.size.caption,
  },
});
