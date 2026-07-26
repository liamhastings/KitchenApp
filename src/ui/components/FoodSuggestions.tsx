import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CatalogFood } from '../../data/catalog';
import { SECTION_LABELS } from '../../data/types';
import { formatCad } from '../../logic/format';
import { colors, fonts, hairline, radius, spacing, type } from '../theme';

interface Props {
  /** What the user has typed so far, trimmed. */
  query: string;
  foods: CatalogFood[];
  onPick: (food: CatalogFood) => void;
  /** Add the raw query as-is. */
  onAddRaw: () => void;
  /** The grocery list cares what a thing costs; inventory doesn't. */
  showPrice?: boolean;
}

/**
 * Catalog autocomplete for a name field.
 *
 * The catalog is a convenience, never a gate: the list always ends with an
 * `Add "…"` row so an unknown food is one tap away from being added as typed.
 */
export function FoodSuggestions({ query, foods, onPick, onAddRaw, showPrice }: Props) {
  const alreadyNamed = foods.some((f) => f.name.toLowerCase() === query.toLowerCase());

  return (
    <View style={styles.suggestions}>
      {foods.map((food) => (
        <Pressable
          key={food.name}
          accessibilityRole="button"
          accessibilityLabel={`Add ${food.name}`}
          onPress={() => onPick(food)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={styles.text}>
            <Text style={styles.name}>{food.name}</Text>
            <Text style={styles.meta}>
              {SECTION_LABELS[food.section]}
              {showPrice ? ` · ${food.unit}` : ''}
            </Text>
          </View>
          {showPrice && <Text style={styles.price}>{formatCad(food.price)}</Text>}
        </Pressable>
      ))}

      {!alreadyNamed && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${query}`}
          onPress={onAddRaw}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <Text style={styles.freeText} numberOfLines={1}>
            Add “{query}”
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestions: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: hairline,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.border,
  },
  pressed: { backgroundColor: colors.linen },
  text: { flexShrink: 1, gap: 2 },
  name: type.label,
  meta: type.meta,
  price: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft },
  freeText: { ...type.label, color: colors.accent },
});
