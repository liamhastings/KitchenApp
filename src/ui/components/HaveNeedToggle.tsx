import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IngredientChoice } from '../../data/types';
import { colors, fonts, hairline, radius, spacing } from '../theme';

interface Props {
  value: IngredientChoice;
  onChange: (choice: IngredientChoice) => void;
}

/**
 * The core interaction of the app: one tap to flip an ingredient between
 * "have it" and "need it". Both options are always visible so overriding a
 * pre-filled suggestion never costs more than a single tap.
 *
 * Rendered as one segmented control on a linen well so the pair reads as a
 * single choice rather than two competing buttons.
 */
export function HaveNeedToggle({ value, onChange }: Props) {
  return (
    <View style={styles.track}>
      <Option
        label="Have it"
        active={value === 'have'}
        activeFg={colors.accent}
        onPress={() => onChange('have')}
      />
      <Option
        label="Need it"
        active={value === 'need'}
        activeFg={colors.clay}
        onPress={() => onChange('need')}
      />
    </View>
  );
}

interface OptionProps {
  label: string;
  active: boolean;
  activeFg: string;
  onPress: () => void;
}

function Option({ label, active, activeFg, onPress }: OptionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        active && { backgroundColor: colors.card, borderColor: activeFg },
        pressed && styles.pressed,
      ]}>
      <Text
        style={[styles.label, { color: active ? activeFg : colors.inkMuted }]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.linen,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  option: {
    paddingHorizontal: spacing.lg + 2,
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: 'transparent',
    minWidth: 96,
    alignItems: 'center',
  },
  pressed: { opacity: 0.6 },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    letterSpacing: 0.1,
  },
});
