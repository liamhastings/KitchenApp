import type { ItemStatus } from '../data/types';

export const colors = {
  bg: '#F6F6F4',
  card: '#FFFFFF',
  border: '#E3E3DF',
  text: '#1B1B18',
  textMuted: '#77776F',
  accent: '#2F7D4F',
  accentSoft: '#E4F1E9',
  danger: '#B3402F',
  dangerSoft: '#F8E7E4',
  warn: '#B4802A',
  warnSoft: '#FAF0DC',
  neutralSoft: '#EDEDE9',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

/** Colour treatment per inventory status, used by pills and inventory rows. */
export const statusColors: Record<ItemStatus, { fg: string; bg: string }> = {
  full: { fg: colors.accent, bg: colors.accentSoft },
  some: { fg: colors.warn, bg: colors.warnSoft },
  none: { fg: colors.danger, bg: colors.dangerSoft },
};

export const untrackedColor = { fg: colors.textMuted, bg: colors.neutralSoft };
