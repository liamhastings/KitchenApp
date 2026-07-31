import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  SECTION_LABELS,
  STORE_SECTIONS,
  type Item,
  type StoreSection,
} from '../../data/types';
import { findExactMatch, searchFoods } from '../../logic/itemSearch';
import { guessSection } from '../../logic/sectionGuess';
import { colors, radius, spacing } from '../theme';
import { Select, type SelectOption } from './Select';

const SECTION_OPTIONS: Array<SelectOption<StoreSection>> = STORE_SECTIONS.map((section) => ({
  value: section,
  label: SECTION_LABELS[section],
}));

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Everything the app already knows about, searched alongside the catalog. */
  knownItems: Item[];
  /** Normalized names already in the inventory, so they can be shown as added. */
  trackedNames: Set<string>;
  onAdd: (name: string, section: StoreSection) => void;
}

/**
 * Search-and-add for the inventory. The list stays open after each add so
 * stocking the kitchen is one pass, not one round trip per item.
 */
export function AddItemSheet({ visible, onClose, knownItems, trackedNames, onAdd }: Props) {
  const [query, setQuery] = useState('');
  // Only set once the user overrules the guess, and only for the name they
  // overruled it for — typing a different food gets a fresh guess.
  const [override, setOverride] = useState<{ name: string; section: StoreSection } | null>(null);

  const suggestions = useMemo(
    () => (visible ? searchFoods(query, knownItems, trackedNames) : []),
    [visible, query, knownItems, trackedNames]
  );

  const trimmed = query.trim();
  // Only offer to create when the query isn't already something we can suggest.
  const canCreate = trimmed.length > 0 && !findExactMatch(trimmed, suggestions);
  const newSection =
    override?.name === trimmed ? override.section : guessSection(trimmed);

  const reset = () => {
    setQuery('');
    setOverride(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const createFromQuery = () => {
    if (!canCreate) return;
    onAdd(trimmed, newSection);
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Text style={styles.title}>Add to inventory</Text>
            <Pressable onPress={close} hitSlop={8} accessibilityRole="button">
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.search}
            placeholder="Search foods"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />

          {canCreate && (
            <View style={styles.createCard}>
              <Text style={styles.createName} numberOfLines={1}>
                Add “{trimmed}”
              </Text>
              <Text style={styles.createHint}>
                New item — we guessed the aisle, change it if that's wrong.
              </Text>
              <View style={styles.createRow}>
                <Select
                  label="Store section"
                  value={newSection}
                  options={SECTION_OPTIONS}
                  onChange={(section) => setOverride({ name: trimmed, section })}
                  style={styles.createSelect}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={createFromQuery}
                  style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                  <Text style={styles.addButtonText}>Add</Text>
                </Pressable>
              </View>
            </View>
          )}

          <FlatList
            data={suggestions}
            keyExtractor={(s) => s.key}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              trimmed.length > 0 ? null : (
                <Text style={styles.emptyText}>Start typing to find a food.</Text>
              )
            }
            renderItem={({ item: suggestion }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: suggestion.tracked }}
                disabled={suggestion.tracked}
                onPress={() => onAdd(suggestion.name, suggestion.section)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={styles.rowText}>
                  <Text
                    style={[styles.rowName, suggestion.tracked && styles.rowNameMuted]}
                    numberOfLines={1}>
                    {suggestion.name}
                  </Text>
                  <Text style={styles.rowSection}>{SECTION_LABELS[suggestion.section]}</Text>
                </View>
                <Text style={suggestion.tracked ? styles.rowAdded : styles.rowAdd}>
                  {suggestion.tracked ? '✓ Added' : '+ Add'}
                </Text>
              </Pressable>
            )}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  done: { fontSize: 16, fontWeight: '700', color: colors.accent },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
  },
  createCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  createName: { fontSize: 16, fontWeight: '700', color: colors.text },
  createHint: { fontSize: 12, color: colors.textMuted },
  createRow: { flexDirection: 'row', gap: spacing.sm },
  createSelect: { flex: 1 },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  listContent: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingTop: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: { flexShrink: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowNameMuted: { color: colors.textMuted },
  rowSection: { fontSize: 12, color: colors.textMuted },
  rowAdd: { fontSize: 14, fontWeight: '700', color: colors.accent },
  rowAdded: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  pressed: { opacity: 0.7 },
});
