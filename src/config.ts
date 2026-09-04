/**
 * Build-time configuration.
 *
 * `EXPO_PUBLIC_*` variables are inlined into the JS bundle, so this key is
 * readable by anyone who unpacks the app. That is acceptable only for a local,
 * single-user build — do not ship a shared or billable key this way. Leaving it
 * unset simply disables the Claude import fallback; JSON-LD import still works.
 */
export const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export const hasClaudeFallback = ANTHROPIC_API_KEY.length > 0;
