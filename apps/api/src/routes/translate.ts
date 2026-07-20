import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { auth, requireScopes, type AuthVariables } from '../middleware/auth.js';

const translateRouter = new Hono<{ Variables: AuthVariables }>();
translateRouter.use('*', auth);

/**
 * GET /translate — proxy to Google Translate API.
 * Used by the schedule panel's CN1/CN2 buttons to add traditional
 * Chinese translations to schedule text.
 */
translateRouter.get(
  '/',
  requireScopes('time-blocks:read'),
  zValidator(
    'query',
    z.object({
      text: z.string().min(1),
      target: z.string().default('zh-TW'),
    })
  ),
  async (c) => {
    const { text, target } = c.req.valid('query');
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      if (!response.ok) {
        return c.json({ success: false, error: 'Translation service error' }, 502);
      }
      const raw: unknown = await response.json();
      // Google returns [[["translated","original",...],...],...]
      const translated = extractTranslated(raw) || text;
      return c.json({ success: true, data: { translated, text, target } });
    } catch {
      return c.json({ success: false, error: 'Translation request failed' }, 502);
    }
  }
);

function extractTranslated(raw: unknown): string | null {
  if (!Array.isArray(raw) || !Array.isArray(raw[0])) return null;
  const parts: string[] = [];
  for (const segment of raw[0] as unknown[]) {
    if (Array.isArray(segment) && typeof segment[0] === 'string') {
      parts.push(segment[0]);
    }
  }
  return parts.length > 0 ? parts.join('') : null;
}

export { translateRouter };
