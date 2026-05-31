import { describe, it, expect, beforeEach } from 'vitest';
import { getAiConfig, setAiKey, setAiModel, clearAiKey, isAiConfigured, DEFAULT_MODEL } from '../features/ai/aiConfig';
import { explainAiError, aiErrorDetail, AiError } from '../features/ai/gemini';

describe('aiConfig (localStorage-backed)', () => {
  beforeEach(() => { clearAiKey(); localStorage.clear(); });

  it('defaults to empty key and the default model', () => {
    const cfg = getAiConfig();
    expect(cfg.apiKey).toBe('');
    expect(cfg.model).toBe(DEFAULT_MODEL);
    expect(isAiConfigured()).toBe(false);
  });

  it('stores and reads the key (trimmed) and model', () => {
    setAiKey('  abc123  ');
    setAiModel('gemini-2.0-flash');
    const cfg = getAiConfig();
    expect(cfg.apiKey).toBe('abc123');
    expect(cfg.model).toBe('gemini-2.0-flash');
    expect(isAiConfigured()).toBe(true);
  });

  it('clearAiKey removes the key', () => {
    setAiKey('xyz'); clearAiKey();
    expect(getAiConfig().apiKey).toBe('');
  });

  it('falls back to default model when set empty', () => {
    setAiModel('');
    expect(getAiConfig().model).toBe(DEFAULT_MODEL);
  });
});

describe('explainAiError', () => {
  it('maps known error codes to friendly messages', () => {
    expect(explainAiError(new AiError('no-key'))).toMatch(/Settings/);
    expect(explainAiError(new AiError('offline'))).toMatch(/internet/i);
    expect(explainAiError(new AiError('bad-key'))).toMatch(/key/i);
    expect(explainAiError(new AiError('rate-limit'))).toMatch(/break|minute/i);
    expect(explainAiError(new AiError('bad-model'))).toMatch(/model/i);
  });
  it('falls back for unknown errors', () => {
    expect(explainAiError(new Error('weird'))).toMatch(/problem|try again/i);
  });
  it('exposes the raw provider detail when present', () => {
    expect(aiErrorDetail(new AiError('bad-key', 'API key not valid', 400))).toBe('API key not valid');
    expect(aiErrorDetail(new AiError('rate-limit'))).toBeUndefined();
    expect(aiErrorDetail(new Error('weird'))).toBeUndefined();
  });
});
