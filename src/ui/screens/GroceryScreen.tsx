import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { GroceryRow } from '../../data/types';
import {
  estimateGroceryTotal,
  findCatalogFood,
  searchCatalog,
} from '../../logic/catalog';
import { formatCad, groupBySection } from '../../logic/format';
import { useAppStore } from '../../state/store';
import { EmptyState, ScreenHeader } from '../components/common';
import { FoodSuggestions } from '../components/FoodSuggestions';
import { colors, fonts, hairline, radius, spacing, type } from '../theme';

export function GroceryScreen() {
  const grocery = useAppStore((s) => s.grocery);
  const toggleChecked = useAppStore((s) => s.toggleGroceryChecked);
  const removeEntry = useAppStore((s) => s.removeGroceryEntry);
  const clearChecked = useAppStore((s) => s.clearCheckedGrocery);
  const putCheckedInKitchen = useAppStore((s) => s.putCheckedInKitchen);
  const addByName = useAppStore((s) => s.addGroceryItemByName);

  const [draftName, setDraftName] = useState('');
  const [draftQuantity, setDraftQuantity] = useState('');

  // Checked items drop to their own group at the bottom so the aisle order of
  // the remaining list stays intact while shopping.
  const sections = useMemo(() => {
    const outstanding = grocery.filter((row) => !row.entry.checked);
    const done = grocery.filter((row) => row.entry.checked);

    const bySection = groupBySection(outstanding, (row) => row.item.section).map((group) => ({
      title: group.title,
      data: group.data,
    }));

    if (done.length > 0) {
      bySection.push({ title: `In the cart (${done.length})`, data: done });
    }
    return bySection;
  }, [grocery]);

  const suggestions = useMemo(() => searchCatalog(draftName), [draftName]);

  // Priced across the whole list, checked included — everything in the cart is
  // still part of the shop.
  const estimate = useMemo(
    () => estimateGroceryTotal(grocery.map((row) => ({ name: row.item.name }))),
    [grocery]
  );

  const checkedCount = grocery.filter((row) => row.entry.checked).length;
  const outstandingCount = grocery.length - checkedCount;

  const add = (name: string, section: GroceryRow['item']['section']) => {
    addByName(name, draftQuantity.trim(), section);
    setDraftName('');
    setDraftQuantity('');
  };

  /**
   * Free text is always addable. If what the user typed happens to name a
   * catalog product we borrow its aisle so the row groups correctly, but an
   * unknown name is never rejected.
   */
  const submitDraft = () => {
    const name = draftName.trim();
    if (!name) return;
    add(name, findCatalogFood(name)?.section ?? 'other');
  };

  const confirmRemove = (row: GroceryRow) => {
    Alert.alert(row.item.name, 'Remove this from your grocery list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeEntry(row.entry.id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          eyebrow={outstandingCount > 0 ? `${outstandingCount} to buy` : 'Nothing pending'}
          title="Grocery"
          action={
            checkedCount > 0 ? (
              <Pressable onPress={clearChecked} hitSlop={8}>
                <Text style={styles.clearAction}>Clear {checkedCount} done</Text>
              </Pressable>
            ) : undefined
          }
        />

        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, styles.inputName]}
            placeholder="Add an item"
            placeholderTextColor={colors.inkMuted}
            value={draftName}
            onChangeText={setDraftName}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={submitDraft}
          />
          <TextInput
            style={[styles.input, styles.inputQuantity]}
            placeholder="Qty"
            placeholderTextColor={colors.inkMuted}
            value={draftQuantity}
            onChangeText={setDraftQuantity}
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
            showPrice
          />
        )}

        <SectionList
          sections={sections}
          keyExtractor={(row) => row.entry.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              title="Nothing to buy"
              body="Mark ingredients as “need it” on a recipe and they'll land here, grouped by aisle."
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionRule} />
            </View>
          )}
          renderItem={({ item: row }) => (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: row.entry.checked }}
              onPress={() => toggleChecked(row.entry.id, !row.entry.checked)}
              onLongPress={() => confirmRemove(row)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={[styles.checkbox, row.entry.checked && styles.checkboxOn]}>
                {row.entry.checked && <Text style={styles.checkmark}>✓</Text>}
              </View>

              <View style={styles.rowText}>
                <Text style={[styles.rowName, row.entry.checked && styles.rowNameChecked]}>
                  {row.item.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {[row.entry.quantity, row.entry.sourceRecipeTitle]
                    .filter(Boolean)
                    .join(' · ') || 'Added manually'}
                </Text>
              </View>

              <ItemPrice name={row.item.name} />
            </Pressable>
          )}
        />

        {grocery.length > 0 && (
          <View style={styles.footer}>
            {checkedCount > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={putCheckedInKitchen}
                style={({ pressed }) => [styles.putAway, pressed && styles.pressed]}>
                <Text style={styles.putAwayText}>
                  Put {checkedCount} in your kitchen
                </Text>
              </Pressable>
            )}
            <EstimateBar estimate={estimate} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Per-row price, blank when the item isn't a catalog product. */
function ItemPrice({ name }: { name: string }) {
  const food = findCatalogFood(name);
  if (!food) return null;
  return <Text style={styles.rowPrice}>{formatCad(food.price)}</Text>;
}

function EstimateBar({ estimate }: { estimate: ReturnType<typeof estimateGroceryTotal> }) {
  return (
    <View style={styles.estimateBar}>
      <View style={styles.estimateText}>
        <Text style={styles.estimateLabel}>Estimated total</Text>
        <Text style={styles.estimateNote}>
          Before tax · one of each
          {estimate.unpricedCount > 0 ? ` · ${estimate.unpricedCount} not priced` : ''}
        </Text>
      </View>
      <Text style={styles.estimateValue}>{formatCad(estimate.total)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  clearAction: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
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
  inputName: { flex: 1 },
  inputQuantity: { width: 68 },
  addButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  addButtonText: { ...type.button, color: colors.onAccent },

  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: type.eyebrow,
  sectionRule: { flex: 1, height: hairline, backgroundColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.65 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: colors.onAccent, fontSize: 12, fontFamily: fonts.semibold },
  rowText: { flex: 1, gap: 3 },
  rowName: type.label,
  rowNameChecked: { textDecorationLine: 'line-through', color: colors.inkMuted },
  rowMeta: type.meta,
  rowPrice: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted },

  footer: {
    borderTopWidth: hairline,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  putAway: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    paddingVertical: spacing.md + 3,
    alignItems: 'center',
  },
  putAwayText: { ...type.button, color: colors.onAccent },
  estimateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  estimateText: { flexShrink: 1, gap: 2 },
  estimateLabel: type.label,
  estimateNote: type.meta,
  estimateValue: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
});
