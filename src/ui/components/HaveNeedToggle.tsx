import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IngredientChoice } from '../../data/types';
import { colors, radius, spacing } from '../theme';

interface Props {
  value: IngredientChoice;
  onChange: (choice: IngredientChoice) => void;
}

/**
 * The core interaction of the app: one tap to flip an ingredient between
 * "have it" and "need it". Both options are always visible so overriding a
 * pre-filled suggestion never costs more than a single tap.
 */
export function HaveNeedToggle({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Option
        label="Have it"
        active={value === 'have'}
        activeFg={colors.accent}
        activeBg={colors.accentSoft}
        onPress={() => onChange('have')}
      />
      <Option
        label="Need it"
        active={value === 'need'}
        activeFg={colors.danger}
        activeBg={colors.dangerSoft}
        onPress={() => onChange('need')}
      />
    </View>
  );
}

interface OptionProps {
  label: string;
  active: boolean;
  activeFg: string;
  activeBg: string;
  onPress: () => void;
}

function Option({ label, active, activeFg, activeBg, onPress }: OptionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        active
          ? { backgroundColor: activeBg, borderColor: activeFg }
          : { backgroundColor: colors.card, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <Text
        style={[styles.label, { color: active ? activeFg : colors.textMuted }]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    minWidth: 92,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
});
