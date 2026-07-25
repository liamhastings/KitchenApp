import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { STATUS_LABELS } from '../../data/types';
import { buildCheckoutPlan, statusAfterHave } from '../../logic/matching';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAppStore } from '../../state/store';
import { Button } from '../components/common';
import { StatusPill } from '../components/StatusPill';
import { colors, radius, spacing } from '../theme';

export function CheckoutScreen({ route, navigation }: RootStackScreenProps<'Checkout'>) {
  const { recipeId, lines } = route.params;
  const getRecipe = useAppStore((s) => s.getRecipe);
  const applyCheckout = useAppStore((s) => s.applyCheckout);

  const recipe = useMemo(() => getRecipe(recipeId), [getRecipe, recipeId]);

  // Off by default: "I need to buy this" is not a claim that the kitchen is
  // empty, so the app never infers a `none` status without being told to.
  const [markNeedAsNone, setMarkNeedAsNone] = useState(false);

  const haveLines = lines.filter((l) => l.choice === 'have');
  const needLines = lines.filter((l) => l.choice === 'need');

  const finish = () => {
    const plan = buildCheckoutPlan(lines, { markNeedAsNone });
    applyCheckout(plan, recipe?.title ?? '');
    navigation.navigate('Tabs', {
      screen: needLines.length > 0 ? 'Grocery' : 'Inventory',
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          {recipe ? `From ${recipe.title}` : 'Review your changes'}
        </Text>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>
            Confirming in your kitchen ({haveLines.length})
          </Text>
          {haveLines.length === 0 ? (
            <Text style={styles.groupEmpty}>Nothing marked "have it".</Text>
          ) : (
            haveLines.map((line) => {
              const next = statusAfterHave(line.status);
              return (
                <View key={line.itemId} style={styles.row}>
                  <Text style={styles.rowName}>{line.itemName}</Text>
                  <View style={styles.rowRight}>
                    <StatusPill status={next} small />
                  </View>
                </View>
              );
            })
          )}
          {haveLines.some((l) => l.status === 'some') && (
            <Text style={styles.note}>
              Items you'd marked "{STATUS_LABELS.some}" stay that way — confirming just
              refreshes the date.
            </Text>
          )}
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Adding to grocery list ({needLines.length})</Text>
          {needLines.length === 0 ? (
            <Text style={styles.groupEmpty}>Nothing marked "need it".</Text>
          ) : (
            needLines.map((line) => (
              <View key={line.itemId} style={styles.row}>
                <Text style={styles.rowName}>{line.itemName}</Text>
                <Text style={styles.rowQuantity}>{line.quantity || '—'}</Text>
              </View>
            ))
          )}

          {needLines.length > 0 && (
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchLabel}>Also mark these as "none"</Text>
                <Text style={styles.switchHint}>
                  Off by default — needing more of something isn't the same as being out
                  of it.
                </Text>
              </View>
              <Switch
                value={markNeedAsNone}
                onValueChange={setMarkNeedAsNone}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Done" onPress={finish} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  lead: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  group: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  groupTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  groupEmpty: { fontSize: 14, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  rowName: { fontSize: 15, color: colors.text, flexShrink: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowQuantity: { fontSize: 13, color: colors.textMuted },
  note: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: spacing.xs },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  switchHint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
});
