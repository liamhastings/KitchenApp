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
import { Button, EmptyState } from '../components/common';
import { colors, radius, spacing } from '../theme';

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
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Recipes</Text>
          <Text style={styles.subtitle}>
            Open one and mark what you have — your inventory and list update from that.
          </Text>
        </View>
      </View>

      <FlatList
        data={recipes}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerActions}>
            <Button
              title="+ Add your own recipe"
              variant="secondary"
              onPress={() => navigation.navigate('AddRecipe')}
            />
            <Button
              title="Find a recipe online"
              variant="secondary"
              onPress={() => navigation.navigate('Browser')}
            />
          </View>
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

      <View style={styles.cardMeta}>
        {!!recipe.servings && <Text style={styles.metaText}>Serves {recipe.servings}</Text>}
        {match && match.total > 0 && (
          <Text style={styles.metaText}>
            {match.onHand} of {match.total} on hand
            {match.unknown > 0 ? ` · ${match.unknown} unknown` : ''}
          </Text>
        )}
      </View>

      {match && match.total > 0 && <MatchBar match={match} />}
    </Pressable>
  );
}

/** Three-segment bar: on hand / missing / never recorded. */
function MatchBar({ match }: { match: RecipeMatch }) {
  return (
    <View style={styles.bar}>
      <View style={[styles.barFill, { flex: match.onHand, backgroundColor: colors.accent }]} />
      <View style={[styles.barFill, { flex: match.missing, backgroundColor: colors.danger }]} />
      <View style={[styles.barFill, { flex: match.unknown, backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  headerText: { gap: spacing.xs },
  title: { fontSize: 30, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  headerActions: { gap: spacing.sm, marginBottom: spacing.xs },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text, flexShrink: 1 },
  yoursBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  cardDescription: { fontSize: 14, color: colors.textMuted, lineHeight: 19 },
  cardMeta: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  bar: { flexDirection: 'row', height: 5, borderRadius: radius.pill, overflow: 'hidden' },
  barFill: { height: 5 },
});
