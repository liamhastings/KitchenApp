import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, hairline, radius, spacing, type } from '../theme';

/**
 * The masthead every tab screen opens with: a small-caps rule, the name set in
 * the display serif, and an optional line of context underneath.
 */
export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderRow}>
        <View style={styles.screenHeaderText}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.screenTitle}>{title}</Text>
        </View>
        {action}
      </View>
      {!!subtitle && <Text style={styles.screenSubtitle}>{subtitle}</Text>}
    </View>
  );
}

/** A hairline rule, used instead of a shadow to separate anything. */
export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyRule} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const palette =
    variant === 'primary'
      ? { bg: colors.accent, fg: colors.onAccent, border: colors.accent }
      : variant === 'danger'
        ? { bg: 'transparent', fg: colors.clay, border: colors.claySoft }
        : { bg: colors.card, fg: colors.ink, border: colors.borderStrong };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  screenHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  screenHeaderText: { flexShrink: 1, gap: spacing.xs },
  screenTitle: type.display,
  screenSubtitle: { ...type.bodySoft, maxWidth: 440 },
  eyebrow: type.eyebrow,
  divider: {
    height: hairline,
    backgroundColor: colors.border,
  },
  empty: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyRule: {
    width: 32,
    height: hairline,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.xs,
  },
  emptyTitle: { ...type.subtitle, textAlign: 'center' },
  emptyBody: { ...type.bodySoft, textAlign: 'center', maxWidth: 280 },
  button: {
    paddingVertical: spacing.md + 3,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: hairline,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.35 },
  pressed: { opacity: 0.65 },
  buttonText: type.button,
});
