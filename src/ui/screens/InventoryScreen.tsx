import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { STATUS_LABELS, type InventoryRow, type ItemStatus } from '../../data/types';
import { relativeDate } from '../../logic/format';
import { useAppStore } from '../../state/store';
import { EmptyState } from '../components/common';
import { colors, radius, spacing, statusColors } from '../theme';

type Filter = 'all' | ItemStatus | 'untracked';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'full', label: 'Full' },
  { key: 'some', label: 'Some' },
  { key: 'none', label: 'None' },
  { key: 'untracked', label: 'Not set' },
];

const STATUS_OPTIONS: ItemStatus[] = ['full', 'some', 'none'];

export function InventoryScreen() {
  const inventory = useAppStore((s) => s.inventory);
  const setItemStatus = useAppStore((s) => s.setItemStatus);
  const addManualItem = useAppStore((s) => s.addManualItem);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [draftName, setDraftName] = useState('');

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = inventory.filter((row) => {
      if (query && !row.item.name.toLowerCase().includes(query)) return false;
      if (filter === 'all') return true;
      if (filter === 'untracked') return row.entry === null;
      return row.entry?.status === filter;
    });

    // Tracked items first, most recently touched at the top; untracked items
    // sink to the bottom alphabetically.
    return [...filtered].sort((a, b) => {
      if (a.entry && b.entry) return b.entry.lastUpdated.localeCompare(a.entry.lastUpdated);
      if (a.entry) return -1;
      if (b.entry) return 1;
      return a.item.name.localeCompare(b.item.name);
    });
  }, [inventory, filter, search]);

  const counts = useMemo(() => {
    let full = 0;
    let some = 0;
    let none = 0;
    for (const row of inventory) {
      if (row.entry?.status === 'full') full += 1;
      else if (row.entry?.status === 'some') some += 1;
      else if (row.entry?.status === 'none') none += 1;
    }
    return { full, some, none };
  }, [inventory]);

  const submitDraft = () => {
    const name = draftName.trim();
    if (!name) return;
    addManualItem(name, 'full', 'other');
    setDraftName('');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.subtitle}>
            {counts.full} full · {counts.some} some · {counts.none} none
          </Text>
        </View>

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="Add an item you have"
            placeholderTextColor={colors.textMuted}
            value={draftName}
            onChangeText={setDraftName}
            returnKeyType="done"
            onSubmitEditing={submitDraft}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add item"
            onPress={submitDraft}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        <TextInput
          style={[styles.input, styles.search]}
          placeholder="Search items"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />

        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(f.key)}
                style={[styles.filterChip, active && styles.filterChipOn]}>
                <Text style={[styles.filterText, active && styles.filterTextOn]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={rows}
          keyExtractor={(row) => row.item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              title="Nothing here"
              body="Items show up once they appear in a recipe or you add them yourself."
            />
          }
          renderItem={({ item: row }) => (
            <InventoryItemRow
              row={row}
              onSetStatus={(status) => setItemStatus(row.item.id, status)}
            />
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InventoryItemRow({
  row,
  onSetStatus,
}: {
  row: InventoryRow;
  onSetStatus: (status: ItemStatus) => void;
}) {
  const current = row.entry?.status ?? null;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.itemName}>{row.item.name}</Text>
        <Text style={styles.itemDate}>{relativeDate(row.entry?.lastUpdated ?? null)}</Text>
      </View>

      <View style={styles.statusRow}>
        {STATUS_OPTIONS.map((status) => {
          const active = current === status;
          const palette = statusColors[status];
          return (
            <Pressable
              key={status}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${row.item.name}: ${STATUS_LABELS[status]}`}
              onPress={() => onSetStatus(status)}
              style={({ pressed }) => [
                styles.statusOption,
                active
                  ? { backgroundColor: palette.bg, borderColor: palette.fg }
                  : { backgroundColor: colors.bg, borderColor: colors.border },
                pressed && styles.pressed,
              ]}>
              <Text
                style={[
                  styles.statusText,
                  { color: active ? palette.fg : colors.textMuted },
                ]}>
                {STATUS_LABELS[status]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
  title: { fontSize: 30, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  search: { marginHorizontal: spacing.lg, marginTop: spacing.sm, flex: 0 },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipOn: { backgroundColor: colors.text, borderColor: colors.text },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterTextOn: { color: colors.card },
  listContent: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemName: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  itemDate: { fontSize: 12, color: colors.textMuted },
  statusRow: { flexDirection: 'row', gap: spacing.sm },
  statusOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  pressed: { opacity: 0.7 },
  statusText: { fontSize: 13, fontWeight: '700' },
});
