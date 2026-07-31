import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  SECTION_LABELS,
  STATUS_LABELS,
  type InventoryRow,
  type ItemStatus,
} from '../../data/types';
import { relativeDate } from '../../logic/format';
import { useAppStore } from '../../state/store';
import { AddItemSheet } from '../components/AddItemSheet';
import { EmptyState } from '../components/common';
import { colors, radius, spacing, statusColors } from '../theme';

type Filter = 'all' | ItemStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'full', label: 'Full' },
  { key: 'some', label: 'Some' },
  { key: 'none', label: 'None' },
];

const STATUS_OPTIONS: ItemStatus[] = ['full', 'some', 'none'];

export function InventoryScreen() {
  const inventory = useAppStore((s) => s.inventory);
  const setItemStatus = useAppStore((s) => s.setItemStatus);
  const addManualItem = useAppStore((s) => s.addManualItem);
  const clearItemStatus = useAppStore((s) => s.clearItemStatus);
  const listKnownItems = useAppStore((s) => s.listKnownItems);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  // Re-read on open, and after each add, so items created by a recipe — or by
  // the sheet itself a second ago — show up as suggestions.
  const knownItems = useMemo(
    () => (adding ? listKnownItems() : []),
    [adding, inventory, listKnownItems]
  );

  const trackedNames = useMemo(
    () => new Set(inventory.map((row) => row.item.normalizedName)),
    [inventory]
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return inventory.filter((row) => {
      if (query && !row.item.name.toLowerCase().includes(query)) return false;
      if (filter === 'all') return true;
      return row.entry?.status === filter;
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

  const confirmRemove = (row: InventoryRow) => {
    Alert.alert(
      'Remove from inventory?',
      `"${row.item.name}" will stop being tracked. Recipes that use it will treat it as unknown again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => clearItemStatus(row.item.id),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.subtitle}>
          {counts.full} full · {counts.some} some · {counts.none} none
        </Text>
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Search your inventory"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add items to inventory"
          onPress={() => setAdding(true)}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </Pressable>
      </View>

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
          inventory.length === 0 ? (
            <EmptyState
              title="Your inventory is empty"
              body="Tap Add to search for food you already have at home. Marking ingredients “have it” during a recipe adds them here too."
            />
          ) : (
            <EmptyState
              title="Nothing matches"
              body="No item in your inventory fits that search or filter."
            />
          )
        }
        renderItem={({ item: row }) => (
          <InventoryItemRow
            row={row}
            onSetStatus={(status) => setItemStatus(row.item.id, status)}
            onRemove={() => confirmRemove(row)}
          />
        )}
      />

      <AddItemSheet
        visible={adding}
        onClose={() => setAdding(false)}
        knownItems={knownItems}
        trackedNames={trackedNames}
        onAdd={(name, section) => addManualItem(name, 'full', section)}
      />
    </SafeAreaView>
  );
}

function InventoryItemRow({
  row,
  onSetStatus,
  onRemove,
}: {
  row: InventoryRow;
  onSetStatus: (status: ItemStatus) => void;
  onRemove: () => void;
}) {
  const current = row.entry?.status ?? null;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardText}>
          <Text style={styles.itemName}>{row.item.name}</Text>
          <Text style={styles.itemMeta}>
            {SECTION_LABELS[row.item.section]} · {relativeDate(row.entry?.lastUpdated ?? null)}
          </Text>
        </View>
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${row.item.name} from inventory`}>
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardText: { flexShrink: 1, gap: 2 },
  itemName: { fontSize: 16, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: 12, color: colors.textMuted },
  removeText: { fontSize: 12, fontWeight: '700', color: colors.danger },
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
