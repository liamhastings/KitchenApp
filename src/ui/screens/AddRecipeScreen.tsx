import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SECTION_LABELS, STORE_SECTIONS, type StoreSection } from '../../data/types';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAppStore } from '../../state/store';
import { Button } from '../components/common';
import { colors, radius, spacing } from '../theme';

interface DraftIngredient {
  key: string;
  name: string;
  quantity: string;
  section: StoreSection;
}

let nextKey = 0;
function blankIngredient(): DraftIngredient {
  nextKey += 1;
  return { key: `draft_${nextKey}`, name: '', quantity: '', section: 'other' };
}

export function AddRecipeScreen({ navigation }: RootStackScreenProps<'AddRecipe'>) {
  const createRecipe = useAppStore((s) => s.createRecipe);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState('');
  const [ingredients, setIngredients] = useState<DraftIngredient[]>(() => [
    blankIngredient(),
    blankIngredient(),
    blankIngredient(),
  ]);

  const updateIngredient = (key: string, patch: Partial<DraftIngredient>) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.key === key ? { ...ing, ...patch } : ing))
    );
  };

  const removeIngredient = (key: string) => {
    setIngredients((prev) => prev.filter((ing) => ing.key !== key));
  };

  /** Tap-to-cycle keeps the section picker to one line per ingredient. */
  const cycleSection = (key: string, current: StoreSection) => {
    const index = STORE_SECTIONS.indexOf(current);
    const next = STORE_SECTIONS[(index + 1) % STORE_SECTIONS.length];
    updateIngredient(key, { section: next });
  };

  const save = () => {
    const cleanTitle = title.trim();
    const filled = ingredients.filter((ing) => ing.name.trim().length > 0);

    if (!cleanTitle) {
      Alert.alert('Add a title', 'Give the recipe a name before saving.');
      return;
    }
    if (filled.length === 0) {
      Alert.alert('Add an ingredient', 'A recipe needs at least one ingredient to be useful.');
      return;
    }

    const recipeId = createRecipe({
      title: cleanTitle,
      description,
      servings,
      isUserCreated: true,
      ingredients: filled.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        section: ing.section,
      })),
    });

    // Replace the modal with the new recipe so the user lands straight in the
    // have/need pass instead of back on the list.
    navigation.replace('RecipeDetail', { recipeId });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Field label="Title">
            <TextInput
              style={styles.input}
              placeholder="Sunday chili"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </Field>

          <Field label="Description (optional)">
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="What makes it worth cooking?"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </Field>

          <Field label="Servings (optional)">
            <TextInput
              style={styles.input}
              placeholder="4"
              placeholderTextColor={colors.textMuted}
              value={servings}
              onChangeText={setServings}
            />
          </Field>

          <Text style={styles.groupLabel}>INGREDIENTS</Text>

          {ingredients.map((ing, index) => (
            <View key={ing.key} style={styles.ingredientCard}>
              <View style={styles.ingredientHeader}>
                <Text style={styles.ingredientIndex}>{index + 1}</Text>
                {ingredients.length > 1 && (
                  <Pressable onPress={() => removeIngredient(ing.key)} hitSlop={8}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.ingredientInputs}>
                <TextInput
                  style={[styles.input, styles.flex]}
                  placeholder="Ingredient"
                  placeholderTextColor={colors.textMuted}
                  value={ing.name}
                  onChangeText={(text) => updateIngredient(ing.key, { name: text })}
                />
                <TextInput
                  style={[styles.input, styles.quantityInput]}
                  placeholder="Qty"
                  placeholderTextColor={colors.textMuted}
                  value={ing.quantity}
                  onChangeText={(text) => updateIngredient(ing.key, { quantity: text })}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Store section: ${SECTION_LABELS[ing.section]}. Tap to change.`}
                onPress={() => cycleSection(ing.key, ing.section)}
                style={({ pressed }) => [styles.sectionChip, pressed && styles.pressed]}>
                <Text style={styles.sectionChipText}>
                  {SECTION_LABELS[ing.section]} ▸
                </Text>
              </Pressable>
            </View>
          ))}

          <Button
            title="+ Add ingredient"
            variant="secondary"
            onPress={() => setIngredients((prev) => [...prev, blankIngredient()])}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Save recipe" onPress={save} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
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
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  ingredientCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  ingredientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ingredientIndex: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  removeText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  ingredientInputs: { flexDirection: 'row', gap: spacing.sm },
  quantityInput: { width: 80 },
  sectionChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  pressed: { opacity: 0.7 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
});
