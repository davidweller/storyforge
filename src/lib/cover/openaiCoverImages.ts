import OpenAI from 'openai';

const IMAGE_MODEL = 'gpt-image-2' as const;
/** Align with Next route `maxDuration` (typically 300s); image models often exceed 120s at high quality. */
const DEFAULT_OPENAI_IMAGE_TIMEOUT_MS = 270_000;

function resolveImageTimeoutMs(): number {
  const raw = process.env.OPENAI_IMAGE_TIMEOUT_MS;
  if (!raw?.trim()) return DEFAULT_OPENAI_IMAGE_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 10_000) return DEFAULT_OPENAI_IMAGE_TIMEOUT_MS;
  return Math.floor(parsed);
}

export async function generateOpenAICoverImages(params: {
  prompt: string;
  n: number;
  quality?: 'standard' | 'high';
}): Promise<{ b64List: string[]; model: string }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const n = Math.min(10, Math.max(1, params.n));
  const quality = params.quality ?? 'high';
  const timeoutMs = resolveImageTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let res: Awaited<ReturnType<typeof openai.images.generate>>;
  try {
    res = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: params.prompt,
      n,
      size: '1024x1536',
      quality,
      output_format: 'png',
    }, {
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error(`OpenAI image call timed out after ${Math.floor(timeoutMs / 1000)}s`);
    }
    if (e instanceof Error && /request was aborted/i.test(e.message)) {
      throw new Error('OpenAI image call was aborted before completion.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  const rows = res.data ?? [];
  const b64List = rows.map((img, i) => {
    if (!img.b64_json) {
      throw new Error(`OpenAI image response missing b64_json at index ${i}`);
    }
    return img.b64_json;
  });
  return { b64List, model: IMAGE_MODEL };
}
