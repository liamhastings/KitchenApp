import { StyleSheet, Text, View } from 'react-native';

import { STATUS_LABELS, type ItemStatus } from '../../data/types';
import { radius, spacing, statusColors, untrackedColor } from '../theme';

interface Props {
  /** null renders the "not tracked yet" state, which is distinct from `none`. */
  status: ItemStatus | null;
  small?: boolean;
}

export function StatusPill({ status, small }: Props) {
  const palette = status ? statusColors[status] : untrackedColor;
  const label = status ? STATUS_LABELS[status] : 'Not set';

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: palette.bg },
        small && styles.pillSmall,
      ]}>
      <Text style={[styles.text, { color: palette.fg }, small && styles.textSmall]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 11,
  },
});
