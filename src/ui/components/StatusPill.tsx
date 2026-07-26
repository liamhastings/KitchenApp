import { StyleSheet, Text, View } from 'react-native';

import { STATUS_LABELS, type ItemStatus } from '../../data/types';
import { fonts, radius, spacing, statusColors, untrackedColor } from '../theme';

interface Props {
  /** null renders the "not tracked yet" state, which is distinct from `none`. */
  status: ItemStatus | null;
  small?: boolean;
}

/**
 * A tinted wash with a matching dot rather than a solid badge — the pill has to
 * label the row without out-shouting the item name next to it.
 */
export function StatusPill({ status, small }: Props) {
  const palette = status ? statusColors[status] : untrackedColor;
  const label = status ? STATUS_LABELS[status] : 'Not set';

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }, small && styles.pillSmall]}>
      <View style={[styles.dot, { backgroundColor: palette.fg }, small && styles.dotSmall]} />
      <Text style={[styles.text, { color: palette.fg }, small && styles.textSmall]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillSmall: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  dotSmall: { width: 5, height: 5 },
  text: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  textSmall: { fontSize: 11 },
});
