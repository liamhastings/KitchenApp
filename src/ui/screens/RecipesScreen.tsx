import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAllRecipeItemIds } from '../../data/recipeRepo';
import type { Recipe } from '../../data/types';
import { computeMatchForItems, type RecipeMatch } from '../../logic/matching';
import type { RootStackParamList } from '../../navigation/types';
import { useAppStore } from '../../state/store';
import { Button, EmptyState, ScreenHeader } from '../components/common';
import { colors, fonts, hairline, radius, spacing, type } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function RecipesScreen() {
  const navigation = useNavigation<Nav>();
  const recipes = useAppStore((s) => s.recipes);
  const statusMap = useAppStore((s) => s.statusMap);

  // Recomputed whenever inventory changes so the "on hand" counts stay honest.
  const matches = useMemo(() => {
    const itemIdsByRecipe = getAllRecipeItemIds();
    const result = new Map<string, RecipeMatch>();
    for (const recipe of recipes) {
      result.set(
        recipe.id,
        computeMatchForItems(itemIdsByRecipe.get(recipe.id) ?? [], statusMap)
      );
    }
    return result;
  }, [recipes, statusMap]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScreenHeader
        eyebrow="Your kitchen"
        title="Recipes"
        subtitle="Open one and mark what you have — your kitchen and list update from that."
      />

      <FlatList
        data={recipes}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Button
            title="Add your own recipe"
            variant="secondary"
            onPress={() => navigation.navigate('AddRecipe')}
            style={styles.addButton}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="No recipes yet"
            body="Add one to start tracking what's in your kitchen."
          />
        }
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            match={matches.get(item.id)}
            onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
          />
        )}
      />
    </SafeAreaView>
  );
}

function RecipeCard({
  recipe,
  match,
  onPress,
}: {
  recipe: Recipe;
  match: RecipeMatch | undefined;
  onPress: () => void;
}) {
  const hasMatch = match && match.total > 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{recipe.title}</Text>
        {recipe.isUserCreated && <Text style={styles.yoursBadge}>Yours</Text>}
      </View>

      {!!recipe.description && (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {recipe.description}
        </Text>
      )}

      {hasMatch && <MatchBar match={match} />}

      <View style={styles.cardMeta}>
        {hasMatch && (
          <Text style={styles.metaCount}>
            <Text style={styles.metaCountStrong}>{match.onHand}</Text> of {match.total} on hand
          </Text>
        )}
        {hasMatch && match.unknown > 0 && (
          <Text style={styles.metaText}>{match.unknown} unknown</Text>
        )}
        {!!recipe.servings && <Text style={styles.metaText}>Serves {recipe.servings}</Text>}
      </View>
    </Pressable>
  );
}

/** Three-segment hairline bar: on hand / missing / never recorded. */
function MatchBar({ match }: { match: RecipeMatch }) {
  return (
    <View style={styles.bar}>
      <View style={[styles.barFill, { flex: match.onHand, backgroundColor: colors.accent }]} />
      <View style={[styles.barFill, { flex: match.missing, backgroundColor: colors.clay }]} />
      <View
        style={[styles.barFill, { flex: match.unknown, backgroundColor: colors.borderStrong }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  addButton: { marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg + 2,
    gap: spacing.md,
  },
  pressed: { opacity: 0.65 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: { ...type.title, flexShrink: 1 },
  yoursBadge: {
    ...type.eyebrow,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  cardDescription: { ...type.bodySoft, marginTop: -spacing.xs },
  cardMeta: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  metaCount: type.meta,
  metaCountStrong: { fontFamily: fonts.semibold, color: colors.ink },
  metaText: type.meta,
  bar: {
    flexDirection: 'row',
    height: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.linen,
  },
  barFill: { height: 3 },
});
