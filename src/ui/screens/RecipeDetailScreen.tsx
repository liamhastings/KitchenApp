import { useLayoutEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { IngredientChoice } from '../../data/types';
import { hostOf } from '../../logic/browserUrl';
import { relativeDate } from '../../logic/format';
import { buildIngredientLines, type IngredientLine } from '../../logic/matching';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAppStore } from '../../state/store';
import { Button } from '../components/common';
import { HaveNeedToggle } from '../components/HaveNeedToggle';
import { StatusPill } from '../components/StatusPill';
import { colors, radius, spacing } from '../theme';

export function RecipeDetailScreen({ route, navigation }: RootStackScreenProps<'RecipeDetail'>) {
  const { recipeId } = route.params;
  const getRecipe = useAppStore((s) => s.getRecipe);
  const statusMap = useAppStore((s) => s.statusMap);
  const deleteRecipe = useAppStore((s) => s.deleteRecipe);

  const recipe = useMemo(() => getRecipe(recipeId), [getRecipe, recipeId]);

  // Seeded once from the inventory snapshot taken when the screen opened. Later
  // inventory changes must not clobber taps the user has already made here.
  const [lines, setLines] = useState<IngredientLine[]>(() =>
    recipe ? buildIngredientLines(recipe, statusMap) : []
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: recipe?.title ?? 'Recipe' });
  }, [navigation, recipe?.title]);

  if (!recipe) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.missing}>This recipe no longer exists.</Text>
      </SafeAreaView>
    );
  }

  const setChoice = (itemId: string, choice: IngredientChoice) => {
    setLines((prev) =>
      prev.map((line) =>
        line.itemId === itemId ? { ...line, choice, isPrefilled: false } : line
      )
    );
  };

  const setAll = (choice: IngredientChoice) => {
    setLines((prev) => prev.map((line) => ({ ...line, choice, isPrefilled: false })));
  };

  const haveCount = lines.filter((l) => l.choice === 'have').length;
  const needCount = lines.length - haveCount;

  const confirmDelete = () => {
    Alert.alert('Delete recipe?', `"${recipe.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteRecipe(recipe.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {!!recipe.description && <Text style={styles.description}>{recipe.description}</Text>}

        <View style={styles.metaRow}>
          {!!recipe.servings && <Text style={styles.meta}>Serves {recipe.servings}</Text>}
          <Text style={styles.meta}>
            {lines.length} ingredient{lines.length === 1 ? '' : 's'}
          </Text>
        </View>

        {!!recipe.sourceUrl && (
          <Pressable
            accessibilityRole="link"
            onPress={() => navigation.navigate('Browser', { url: recipe.sourceUrl })}
            hitSlop={4}>
            <Text style={styles.sourceLink}>
              Method and full instructions at {hostOf(recipe.sourceUrl) || 'the source'} ↗
            </Text>
          </Pressable>
        )}

        <View style={styles.bulkRow}>
          <Text style={styles.bulkLabel}>Mark all</Text>
          <Pressable onPress={() => setAll('have')} hitSlop={8}>
            <Text style={[styles.bulkAction, { color: colors.accent }]}>Have it</Text>
          </Pressable>
          <Pressable onPress={() => setAll('need')} hitSlop={8}>
            <Text style={[styles.bulkAction, { color: colors.danger }]}>Need it</Text>
          </Pressable>
        </View>

        {lines.map((line) => (
          <View key={line.itemId} style={styles.ingredientCard}>
            <View style={styles.ingredientTop}>
              <View style={styles.ingredientNames}>
                <Text style={styles.ingredientName}>{line.itemName}</Text>
                {!!line.quantity && <Text style={styles.quantity}>{line.quantity}</Text>}
              </View>
              <StatusPill status={line.status} small />
            </View>

            <Text style={styles.lastUpdated}>
              {line.status
                ? `You set this ${relativeDate(line.lastUpdated).toLowerCase()}`
                : 'Never tracked'}
              {line.isPrefilled ? ' · suggested below' : ''}
            </Text>

            <HaveNeedToggle
              value={line.choice}
              onChange={(choice) => setChoice(line.itemId, choice)}
            />
          </View>
        ))}

        {recipe.isUserCreated && (
          <Button title="Delete recipe" variant="danger" onPress={confirmDelete} />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerSummary}>
          {haveCount} have · {needCount} need
        </Text>
        <Button
          title="Review & finish"
          onPress={() => navigation.navigate('Checkout', { recipeId, lines })}
          disabled={lines.length === 0}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  missing: { padding: spacing.xl, textAlign: 'center', color: colors.textMuted },
  description: { fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  metaRow: { flexDirection: 'row', gap: spacing.lg },
  meta: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  sourceLink: { fontSize: 13, fontWeight: '600', color: colors.accent },
  bulkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  bulkLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  bulkAction: { fontSize: 13, fontWeight: '700' },
  ingredientCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  ingredientTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ingredientNames: { flexShrink: 1, gap: 2 },
  ingredientName: { fontSize: 17, fontWeight: '700', color: colors.text },
  quantity: { fontSize: 13, color: colors.textMuted },
  lastUpdated: { fontSize: 12, color: colors.textMuted },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  footerSummary: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
});
