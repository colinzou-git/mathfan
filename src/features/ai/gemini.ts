import { getAiConfig } from './aiConfig';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ProblemContext {
  prompt: string;            // the question shown to the student
  answer: string | number;   // correct answer — used to guide, NEVER revealed
  itemType: string;
  studentAnswer?: string;    // their latest wrong attempt, if any
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** A warm, Socratic elementary-math tutor. The cardinal rule: never give the answer. */
function systemInstruction(ctx: ProblemContext): string {
  return [
    "You are MathFan's friendly tutor for a child in grades 3–5 (about 8–11 years old).",
    'Your job is to GUIDE, not to give answers. Be warm, patient, and encouraging.',
    '',
    'HARD RULES:',
    '1. NEVER state the final answer, even if asked directly or repeatedly. If the child',
    '   begs, gently encourage them and give the next small hint instead.',
    '2. Give ONE short guiding question or ONE small hint at a time.',
    '3. Use simple words and short sentences — at most 3–4 sentences per reply.',
    '4. Build on what the child says; praise the good part of their thinking first.',
    '5. Suggest concrete strategies (draw a picture, break the number apart, use a known',
    '   fact, count up, use a number line, look for a pattern).',
    '6. If their reasoning is right, tell them they are on the right track and let THEM',
    '   say the final number — never say it for them.',
    '7. Stay on this math topic. Stay positive; never criticize. Spark curiosity.',
    '',
    `Current problem the child is working on: "${ctx.prompt}"`,
    `(For your reference only — the correct answer is ${ctx.answer}. NEVER reveal this number.)`,
    ctx.studentAnswer ? `The child just tried: "${ctx.studentAnswer}" (not correct yet).` : '',
    'Help them take the next step.',
  ].filter(Boolean).join('\n');
}

export class AiError extends Error {}

/** Send the conversation to Gemini and return the tutor's next message. */
export async function askTutor(
  history: ChatMessage[],
  ctx: ProblemContext,
  signal?: AbortSignal,
): Promise<string> {
  const { apiKey, model } = getAiConfig();
  if (!apiKey) throw new AiError('no-key');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AiError('offline');

  const body = {
    system_instruction: { parts: [{ text: systemInstruction(ctx) }] },
    contents: history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 220 },
  };

  let res: Response;
  try {
    res = await fetch(
      `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal },
    );
  } catch {
    throw new AiError('network');
  }

  if (!res.ok) {
    if (res.status === 400 || res.status === 403) throw new AiError('bad-key');
    if (res.status === 429) throw new AiError('rate-limit');
    throw new AiError('server');
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('').trim();
  if (!text) throw new AiError('empty');
  return text;
}

export function explainAiError(err: unknown): string {
  const code = err instanceof AiError ? err.message : 'server';
  switch (code) {
    case 'no-key': return 'No AI key yet. A grown-up can add one in Settings → AI Tutor.';
    case 'offline':
    case 'network': return 'The tutor needs an internet connection. Try again when you are online.';
    case 'bad-key': return "That AI key didn't work. A grown-up can check it in Settings → AI Tutor.";
    case 'rate-limit': return 'The tutor is taking a quick break (too many questions). Try again in a minute.';
    case 'empty': return "Hmm, the tutor didn't reply. Try asking again.";
    default: return 'The tutor had a problem. Please try again.';
  }
}
