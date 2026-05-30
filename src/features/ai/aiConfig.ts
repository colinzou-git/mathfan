/**
 * AI tutor configuration — stored in localStorage ONLY (never in the profile or
 * the Drive snapshot). The API key is the family's own credential; keeping it
 * out of sync avoids ever uploading it.
 *
 * Recommend the user restrict the key by HTTP referrer in Google AI Studio.
 * For a published build, a sign-in-gated serverless proxy is the more secure
 * option (see PLATFORM.md §2.6) — tracked as MF-224.
 */

const KEY_API = 'mathfan_ai_key';
const KEY_MODEL = 'mathfan_ai_model';

export const DEFAULT_MODEL = 'gemini-2.0-flash';

export interface AiConfig {
  apiKey: string;
  model: string;
}

export function getAiConfig(): AiConfig {
  let apiKey = '';
  let model = DEFAULT_MODEL;
  try {
    apiKey = localStorage.getItem(KEY_API) ?? '';
    model = localStorage.getItem(KEY_MODEL) || DEFAULT_MODEL;
  } catch { /* storage blocked */ }
  return { apiKey, model };
}

export function setAiKey(key: string): void {
  try { localStorage.setItem(KEY_API, key.trim()); } catch { /* ignore */ }
}

export function setAiModel(model: string): void {
  try { localStorage.setItem(KEY_MODEL, (model || DEFAULT_MODEL).trim()); } catch { /* ignore */ }
}

export function clearAiKey(): void {
  try { localStorage.removeItem(KEY_API); } catch { /* ignore */ }
}

export function isAiConfigured(): boolean {
  return getAiConfig().apiKey.length > 0;
}
