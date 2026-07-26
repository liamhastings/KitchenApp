import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { STATUS_LABELS } from '../../data/types';
import { buildCheckoutPlan, statusAfterHave } from '../../logic/matching';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAppStore } from '../../state/store';
import { Button, Divider } from '../components/common';
import { StatusPill } from '../components/StatusPill';
import { colors, fonts, hairline, radius, spacing, type } from '../theme';

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>{recipe ? recipe.title : 'Review'}</Text>
          <Text style={styles.introTitle}>Here's what changes</Text>
        </View>

        <View style={styles.group}>
          <View style={styles.groupHead}>
            <Text style={styles.groupTitle}>Confirming in your kitchen</Text>
            <Text style={styles.groupCount}>{haveLines.length}</Text>
          </View>
          <Divider />

          {haveLines.length === 0 ? (
            <Text style={styles.groupEmpty}>Nothing marked "have it".</Text>
          ) : (
            haveLines.map((line) => (
              <View key={line.itemId} style={styles.row}>
                <Text style={styles.rowName}>{line.itemName}</Text>
                <StatusPill status={statusAfterHave(line.status)} small />
              </View>
            ))
          )}

          {haveLines.some((l) => l.status === 'some') && (
            <Text style={styles.note}>
              Items you'd marked "{STATUS_LABELS.some}" stay that way — confirming just
              refreshes the date.
            </Text>
          )}
        </View>

        <View style={styles.group}>
          <View style={styles.groupHead}>
            <Text style={styles.groupTitle}>Adding to grocery list</Text>
            <Text style={styles.groupCount}>{needLines.length}</Text>
          </View>
          <Divider />

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
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  intro: { gap: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.xs },
  eyebrow: type.eyebrow,
  introTitle: type.display,
  group: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  groupTitle: { ...type.subtitle, flexShrink: 1 },
  groupCount: { fontFamily: fonts.display, fontSize: 24, color: colors.inkMuted },
  groupEmpty: type.bodySoft,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowName: { ...type.label, flexShrink: 1 },
  rowQuantity: type.meta,
  note: {
    ...type.meta,
    lineHeight: 18,
    backgroundColor: colors.linen,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.border,
  },
  switchText: { flex: 1, gap: 3 },
  switchLabel: type.label,
  switchHint: { ...type.meta, lineHeight: 17 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
});
