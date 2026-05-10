import OpenAI from 'openai';
import type { ProjectStyleReference } from '@/types';

const CAPTION_MODEL = 'gpt-4o-mini';

function fallbackNotesSummary(refs: ProjectStyleReference[]): string {
  if (!refs.length) return '';
  return refs
    .map((r, i) => {
      const n = r.note?.trim();
      return n ? `Reference ${i + 1} (author): ${n}` : `Reference ${i + 1}: (uploaded mood reference — emulate palette and composition broadly; do not copy titles or likenesses).`;
    })
    .join('\n');
}

/**
 * One vision pass over user reference covers / A+ examples → compact textual constraints for IMAGE models (no images inline).
 */
export async function summarizeStyleReferencesForPrompt(
  refs: ProjectStyleReference[],
  intent: 'cover' | 'aplus'
): Promise<string> {
  if (!refs.length) return '';
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return fallbackNotesSummary(refs);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const userNotes = refs.map((r, i) => (r.note?.trim() ? `Slot ${i + 1}: ${r.note.trim()}` : `Slot ${i + 1}: (no note)`)).join('\n');

  const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text:
        intent === 'cover'
          ? `You help commercial book-cover art direction. For each attached reference cover screenshot, summarise in 3–6 short bullet lines total: palette tendencies, contrast, illustrative vs photographic feel, typography density, focal layout (centered/bar title), mood. ${userNotes ? `Integrate author notes:\n${userNotes}` : ''}\nDo not transcribe readable titles or logos. Avoid copying any single reference — synthesise transferable style cues for a NEW original cover.`
          : `You analyse Amazon A+ module screenshots. Summarise 3–6 bullet lines total: layout rhythm, typography treatment, figurative vs abstract balance, whitespace, colour chords, editorial vs cinematic feel. ${userNotes ? `Author intent:\n${userNotes}` : ''}\nDo not transcribe logos or quotes. Give cues for ORIGINAL variants in the same design language.`,
    },
    ...refs.map(
      (r): OpenAI.Chat.Completions.ChatCompletionContentPart => ({
        type: 'image_url',
        image_url: { url: `data:${r.mimeType};base64,${r.base64Data}`, detail: 'low' },
      })
    ),
  ];

  try {
    const res = await openai.chat.completions.create({
      model: CAPTION_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: contentParts,
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (text) return text.slice(0, 4000);
  } catch {
    /* fall through */
  }

  return fallbackNotesSummary(refs);
}
