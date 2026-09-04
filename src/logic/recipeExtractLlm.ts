import type { ExtractedRecipe } from './recipeExtract';

/**
 * Fallback for pages that publish no JSON-LD Recipe: ask Claude to read the
 * page's visible text and hand back the same `ExtractedRecipe` shape.
 *
 * Split in three so the interesting parts stay checkable in plain Node — the
 * prompt and the response parser are pure, and the one function that touches
 * the network takes its `fetch` as an argument.
 *
 * Raw HTTP rather than `@anthropic-ai/sdk` because that SDK does not support
 * React Native ("Note that React Native is not supported at this time").
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-5';

/** A recipe's worth of JSON is small; the cap just bounds a runaway page. */
const MAX_TOKENS = 8000;

/** Matches the cap the WebView applies when it reads document.innerText. */
const MAX_PAGE_CHARS = 40000;

const SYSTEM_PROMPT = [
  'You extract recipes from the visible text of a web page.',
  'Reply with a single JSON object and nothing else — no prose, no explanation,',
  'no markdown code fences.',
  'Shape: {"title": string, "ingredients": [{"text": string}], "steps": [string],',
  '"servings": string, "description": string}.',
  'Each ingredient "text" is one line exactly as the page writes it, quantity included',
  '(for example "2 cups all-purpose flour"). Do not invent ingredients, quantities, or',
  'steps that the page does not state. "servings" and "description" may be empty strings.',
  'If the page is not a recipe, reply with exactly {"title": ""}.',
].join(' ');

export function buildExtractionPrompt(pageText: string, sourceUrl: string): string {
  const text = pageText.slice(0, MAX_PAGE_CHARS);
  return `Page URL: ${sourceUrl}\n\nPage text:\n"""\n${text}\n"""`;
}

/**
 * Reads the model's reply. Tolerates a fenced or prose-wrapped object even
 * though the prompt asks for neither, and returns null for anything that is
 * not a recipe — a bad parse must fail the import, never save a guess.
 */
export function parseLlmRecipeJson(raw: string, sourceUrl: string): ExtractedRecipe | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();

  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const node = parsed as Record<string, unknown>;
  const title = typeof node.title === 'string' ? node.title.trim() : '';

  const ingredients = Array.isArray(node.ingredients)
    ? node.ingredients
        .map((entry) => {
          if (typeof entry === 'string') return entry.trim();
          if (entry && typeof entry === 'object') {
            const text = (entry as Record<string, unknown>).text;
            return typeof text === 'string' ? text.trim() : '';
          }
          return '';
        })
        .filter((text) => text.length > 0)
        .map((text) => ({ text }))
    : [];

  // Same bar the JSON-LD path applies: no title or no ingredients, no recipe.
  if (!title || ingredients.length === 0) return null;

  const steps = Array.isArray(node.steps)
    ? node.steps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];
  const servings = typeof node.servings === 'string' ? node.servings.trim() : '';
  const description = typeof node.description === 'string' ? node.description.trim() : '';

  return {
    title,
    ingredients,
    steps: steps.map((s) => s.trim()),
    ...(servings ? { servings } : {}),
    ...(description ? { description } : {}),
    sourceUrl,
  };
}

export type LlmFailureReason = 'no_api_key' | 'request_failed' | 'refused' | 'unreadable';

export type LlmExtractionResult =
  | { ok: true; recipe: ExtractedRecipe }
  | { ok: false; reason: LlmFailureReason };

export interface LlmExtractionOptions {
  apiKey: string;
  /** Injectable so the request can be exercised without a network. */
  fetchImpl?: typeof fetch;
}

interface AnthropicResponse {
  stop_reason?: string;
  content?: Array<{ type?: string; text?: string }>;
}

/**
 * One non-streaming Messages request. Never throws — every failure comes back
 * as a reason the caller can show, because "we could not read this page" is a
 * real answer and a half-parsed recipe is not.
 */
export async function extractRecipeWithClaude(
  pageText: string,
  sourceUrl: string,
  options: LlmExtractionOptions
): Promise<LlmExtractionResult> {
  if (!options.apiKey) return { ok: false, reason: 'no_api_key' };

  const doFetch = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await doFetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
        // Re-runs the request on Anthropic's recommended model if a safety
        // classifier declines it, instead of handing back the refusal.
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        fallbacks: 'default',
        // Adaptive thinking (the default on this model) at low effort: reading
        // a page into fixed fields is mechanical work.
        output_config: { effort: 'low' },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildExtractionPrompt(pageText, sourceUrl) }],
      }),
    });
  } catch {
    return { ok: false, reason: 'request_failed' };
  }

  if (!response.ok) return { ok: false, reason: 'request_failed' };

  let payload: AnthropicResponse;
  try {
    payload = (await response.json()) as AnthropicResponse;
  } catch {
    return { ok: false, reason: 'request_failed' };
  }

  // Check the stop reason before reading content.
  if (payload.stop_reason === 'refusal') return { ok: false, reason: 'refused' };

  const text = (payload.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n');
  if (!text.trim()) return { ok: false, reason: 'unreadable' };

  const recipe = parseLlmRecipeJson(text, sourceUrl);
  return recipe ? { ok: true, recipe } : { ok: false, reason: 'unreadable' };
}
