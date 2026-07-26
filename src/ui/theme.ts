import { StyleSheet, type TextStyle } from 'react-native';

import type { ItemStatus } from '../data/types';

/**
 * Scandinavian design system: warm paper rather than grey, hairline rules
 * rather than shadows, muted natural pigments rather than saturated UI colours,
 * and a lot of air. Two typefaces do all the work — an editorial serif for
 * anything that names something, a neutral grotesque for everything else.
 */

export const colors = {
  /** Warm unbleached paper — the base of every screen. */
  bg: '#FAF8F4',
  /** Raised surfaces. Kept pure white so cards read as paper on paper. */
  card: '#FFFFFF',
  /** Recessed fills: inputs, inactive chips, wells. */
  linen: '#F1EDE5',
  /** Hairline rules. Deliberately low contrast — structure, not decoration. */
  border: '#E6E0D5',
  /** For the rare border that has to be seen (focused, selected). */
  borderStrong: '#CFC7B8',

  ink: '#23211C',
  inkSoft: '#57524A',
  inkMuted: '#8B8477',

  /** Spruce — the single accent. Muted enough to sit under the typography. */
  accent: '#4F6F5A',
  accentSoft: '#E7EDE7',
  /** Clay — "need it", destructive. A terracotta, never a fire-engine red. */
  clay: '#A85F48',
  claySoft: '#F4E8E1',
  /** Ochre — the "some" middle state. */
  ochre: '#9C7C38',
  ochreSoft: '#F3ECDC',

  /** On-accent text. */
  onAccent: '#FBFAF7',
} as const;

/** 4pt base. Scandinavian layouts lean on the top of this scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 36,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

/** One hairline everywhere; RN resolves this to a true 1px on the device. */
export const hairline = StyleSheet.hairlineWidth;

export const fonts = {
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

/**
 * Custom fonts on iOS ignore `fontWeight` — weight has to come from the family
 * name. Every text style in the app is defined here so no screen has to
 * remember that.
 */
export const type = {
  /** Screen titles. */
  display: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  /** Card titles, recipe names — anything that names a thing. */
  title: {
    fontFamily: fonts.display,
    fontSize: 25,
    lineHeight: 30,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: colors.ink,
  },
  /** Small caps rule above a title or over a group of rows. */
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.inkMuted,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  bodySoft: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.inkSoft,
  },
  /** Row labels and anything that has to hold its own next to a serif. */
  label: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 20,
    color: colors.ink,
  },
  /** Timestamps, counts, quantities. */
  meta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkMuted,
  },
  metaStrong: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkSoft,
  },
  button: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
} satisfies Record<string, TextStyle>;

/** Pigment per inventory status, used by pills, rows and status pickers. */
export const statusColors: Record<ItemStatus, { fg: string; bg: string }> = {
  full: { fg: colors.accent, bg: colors.accentSoft },
  some: { fg: colors.ochre, bg: colors.ochreSoft },
  none: { fg: colors.clay, bg: colors.claySoft },
};

/** Untracked is its own state — never styled as `none`. */
export const untrackedColor = { fg: colors.inkMuted, bg: colors.linen };
