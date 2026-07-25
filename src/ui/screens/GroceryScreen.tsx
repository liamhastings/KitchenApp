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
import { groupBySection } from '../../logic/format';
import { useAppStore } from '../../state/store';
import { EmptyState } from '../components/common';
import { colors, radius, spacing } from '../theme';

export function GroceryScreen() {
  const grocery = useAppStore((s) => s.grocery);
  const toggleChecked = useAppStore((s) => s.toggleGroceryChecked);
  const removeEntry = useAppStore((s) => s.removeGroceryEntry);
  const clearChecked = useAppStore((s) => s.clearCheckedGrocery);
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

  const checkedCount = grocery.filter((row) => row.entry.checked).length;

  const submitDraft = () => {
    const name = draftName.trim();
    if (!name) return;
    addByName(name, draftQuantity.trim(), 'other');
    setDraftName('');
    setDraftQuantity('');
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
        <View style={styles.header}>
          <Text style={styles.title}>Grocery List</Text>
          {checkedCount > 0 && (
            <Pressable onPress={clearChecked} hitSlop={8}>
              <Text style={styles.clearAction}>Clear {checkedCount} done</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, styles.inputName]}
            placeholder="Add an item"
            placeholderTextColor={colors.textMuted}
            value={draftName}
            onChangeText={setDraftName}
            returnKeyType="done"
            onSubmitEditing={submitDraft}
          />
          <TextInput
            style={[styles.input, styles.inputQuantity]}
            placeholder="Qty"
            placeholderTextColor={colors.textMuted}
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

        <SectionList
          sections={sections}
          keyExtractor={(row) => row.entry.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <EmptyState
              title="Nothing to buy"
              body="Mark ingredients as “need it” on a recipe and they'll land here, grouped by aisle."
            />
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title.toUpperCase()}</Text>
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
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: { fontSize: 30, fontWeight: '800', color: colors.text },
  clearAction: { fontSize: 13, fontWeight: '700', color: colors.accent },
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
  },
  inputName: { flex: 1 },
  inputQuantity: { width: 70 },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowNameChecked: { textDecorationLine: 'line-through', color: colors.textMuted },
  rowMeta: { fontSize: 12, color: colors.textMuted },
});
