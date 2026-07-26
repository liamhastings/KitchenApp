import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  Alert,
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

import { getAllRecipeItemIds } from '../../data/recipeRepo';
import {
  STATUS_LABELS,
  type InventoryRow,
  type ItemStatus,
  type Recipe,
  type StoreSection,
} from '../../data/types';
import { findCatalogFood, searchCatalog } from '../../logic/catalog';
import { relativeDate } from '../../logic/format';
import { splitCookable, type CookableRecipe } from '../../logic/matching';
import type { RootStackParamList } from '../../navigation/types';
import { useAppStore } from '../../state/store';
import { EmptyState, ScreenHeader } from '../components/common';
import { FoodSuggestions } from '../components/FoodSuggestions';
import { colors, fonts, hairline, radius, spacing, statusColors, type } from '../theme';

type Filter = 'all' | ItemStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'full', label: 'Full' },
  { key: 'some', label: 'Some' },
  { key: 'none', label: 'None' },
];

const STATUS_OPTIONS: ItemStatus[] = ['full', 'some', 'none'];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function InventoryScreen() {
  const navigation = useNavigation<Nav>();
  const recipes = useAppStore((s) => s.recipes);
  const statusMap = useAppStore((s) => s.statusMap);
  const inventory = useAppStore((s) => s.inventory);
  const setItemStatus = useAppStore((s) => s.setItemStatus);
  const addManualItem = useAppStore((s) => s.addManualItem);
  const clearItemStatus = useAppStore((s) => s.clearItemStatus);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [draftName, setDraftName] = useState('');

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = inventory.filter((row) => {
      if (query && !row.item.name.toLowerCase().includes(query)) return false;
      if (filter === 'all') return true;
      return row.entry?.status === filter;
    });

    // Most recently touched at the top.
    return [...filtered].sort((a, b) =>
      (b.entry?.lastUpdated ?? '').localeCompare(a.entry?.lastUpdated ?? '')
    );
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

  const isEmpty = inventory.length === 0;
  const suggestions = useMemo(() => searchCatalog(draftName), [draftName]);

  // Recomputed whenever a status changes, so the suggestions never outlive the
  // kitchen they were derived from.
  const cookable = useMemo(() => {
    const itemIdsByRecipe = getAllRecipeItemIds();
    return splitCookable(
      recipes.map((recipe) => ({ recipe, itemIds: itemIdsByRecipe.get(recipe.id) ?? [] })),
      statusMap
    );
  }, [recipes, statusMap]);

  // "Add an item you have" — so it lands as `full`. Borrowing the catalog's
  // aisle here means the item is already grouped correctly if it later ends up
  // on the grocery list.
  const add = (name: string, section: StoreSection) => {
    addManualItem(name, 'full', section);
    setDraftName('');
  };

  const submitDraft = () => {
    const name = draftName.trim();
    if (!name) return;
    add(name, findCatalogFood(name)?.section ?? 'other');
  };

  /**
   * Untracking is not the same as saying "none" — it removes the user's
   * statement entirely, putting the item back to never-said. The item and any
   * recipes using it are untouched.
   */
  const confirmRemove = (row: InventoryRow) => {
    Alert.alert(row.item.name, 'Remove this from your kitchen?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => clearItemStatus(row.item.id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          eyebrow={isEmpty ? 'Nothing tracked yet' : "What's on hand"}
          title="Your Kitchen"
        />

        {!isEmpty && (
          <View style={styles.tallies}>
            <Tally value={counts.full} label={STATUS_LABELS.full} tint={statusColors.full.fg} />
            <Tally value={counts.some} label={STATUS_LABELS.some} tint={statusColors.some.fg} />
            <Tally value={counts.none} label={STATUS_LABELS.none} tint={statusColors.none.fg} />
          </View>
        )}

        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Add an item you have"
            placeholderTextColor={colors.inkMuted}
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

        {draftName.trim().length > 0 && (
          <FoodSuggestions
            query={draftName.trim()}
            foods={suggestions}
            onPick={(food) => add(food.name, food.section)}
            onAddRaw={submitDraft}
          />
        )}

        {!isEmpty && (
          <>
            <TextInput
              style={[styles.input, styles.search]}
              placeholder="Search items"
              placeholderTextColor={colors.inkMuted}
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
          </>
        )}

        <FlatList
          data={rows}
          keyExtractor={(row) => row.item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            isEmpty ? null : (
              <CookableBlock
                cookable={cookable}
                onOpen={(recipeId) => navigation.navigate('RecipeDetail', { recipeId })}
              />
            )
          }
          ListEmptyComponent={
            isEmpty ? (
              <EmptyState
                title="Add your kitchen here"
                body="Nothing is tracked yet. Add what you already have above, mark ingredients as “have it” on a recipe, or put your shopping away from the grocery list."
              />
            ) : (
              <EmptyState
                title="No matches"
                body="Nothing in your kitchen matches that search or filter."
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * "What can I make with this?" — the payoff for keeping a kitchen up to date.
 *
 * Split in two so the claim is always exactly as strong as the data: `ready`
 * means every ingredient is confirmed on hand, `nearly` means it's close but
 * something is either out or was never recorded. The second list says how many
 * are unconfirmed rather than implying the user is missing them.
 */
function CookableBlock({
  cookable,
  onOpen,
}: {
  cookable: {
    ready: Array<CookableRecipe<Recipe>>;
    nearly: Array<CookableRecipe<Recipe>>;
  };
  onOpen: (recipeId: string) => void;
}) {
  const { ready, nearly } = cookable;
  if (ready.length === 0 && nearly.length === 0) return null;

  return (
    <View style={styles.cookable}>
      {ready.length > 0 && (
        <>
          <Text style={styles.cookableEyebrow}>You can make</Text>
          {ready.map(({ recipe, match }) => (
            <CookableCard
              key={recipe.id}
              title={recipe.title}
              note={`All ${match.total} on hand`}
              tone="ready"
              onPress={() => onOpen(recipe.id)}
            />
          ))}
        </>
      )}

      {nearly.length > 0 && (
        <>
          <Text style={[styles.cookableEyebrow, ready.length > 0 && styles.cookableGap]}>
            Almost there
          </Text>
          {nearly.slice(0, 3).map(({ recipe, match, gaps }) => (
            <CookableCard
              key={recipe.id}
              title={recipe.title}
              note={
                match.unknown === gaps
                  ? `${gaps} still unconfirmed`
                  : `${match.onHand} of ${match.total} on hand`
              }
              tone="nearly"
              onPress={() => onOpen(recipe.id)}
            />
          ))}
        </>
      )}
    </View>
  );
}

function CookableCard({
  title,
  note,
  tone,
  onPress,
}: {
  title: string;
  note: string;
  tone: 'ready' | 'nearly';
  onPress: () => void;
}) {
  const tint = tone === 'ready' ? colors.accent : colors.inkMuted;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.cookableCard, pressed && styles.pressed]}>
      <View style={[styles.cookableDot, { backgroundColor: tint }]} />
      <View style={styles.cookableText}>
        <Text style={styles.cookableTitle}>{title}</Text>
        <Text style={[styles.cookableNote, { color: tint }]}>{note}</Text>
      </View>
    </Pressable>
  );
}

/** One figure from the at-a-glance count, set in the display serif. */
function Tally({ value, label, tint }: { value: number; label: string; tint: string }) {
  return (
    <View style={styles.tally}>
      <Text style={[styles.tallyValue, { color: tint }]}>{value}</Text>
      <Text style={styles.tallyLabel}>{label}</Text>
    </View>
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
      {/*
        Long-press the name to untrack, matching how the grocery list removes a
        row. It hangs off the name rather than the whole card so a long press
        that lands on a status button can't be swallowed.
      */}
      <Pressable
        onLongPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={row.item.name}
        accessibilityHint="Long press to remove from inventory"
        style={styles.cardTop}>
        <Text style={styles.itemName}>{row.item.name}</Text>
        <Text style={styles.itemDate}>{relativeDate(row.entry?.lastUpdated ?? null)}</Text>
      </Pressable>

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
                  : { backgroundColor: colors.linen, borderColor: 'transparent' },
                pressed && styles.pressed,
              ]}>
              <Text
                style={[styles.statusText, { color: active ? palette.fg : colors.inkMuted }]}>
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
  tallies: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.xl,
  },
  tally: { gap: 2 },
  tallyValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  tallyLabel: type.eyebrow,
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  input: {
    ...type.body,
    backgroundColor: colors.linen,
    borderWidth: hairline,
    borderColor: 'transparent',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  search: { marginHorizontal: spacing.xl, marginTop: spacing.sm },
  addButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  addButtonText: { ...type.button, color: colors.onAccent },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted },
  filterTextOn: { color: colors.onAccent },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  cookable: { paddingBottom: spacing.lg, gap: spacing.sm },
  cookableEyebrow: { ...type.eyebrow, marginBottom: spacing.xs },
  cookableGap: { marginTop: spacing.lg },
  cookableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  cookableDot: { width: 6, height: 6, borderRadius: radius.pill },
  cookableText: { flexShrink: 1, gap: 2 },
  cookableTitle: type.subtitle,
  cookableNote: { fontFamily: fonts.medium, fontSize: 12 },
  card: {
    backgroundColor: colors.card,
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemName: { ...type.subtitle, flexShrink: 1 },
  itemDate: type.meta,
  statusRow: { flexDirection: 'row', gap: spacing.sm },
  statusOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  pressed: { opacity: 0.65 },
  statusText: { fontFamily: fonts.medium, fontSize: 13 },
});
