import OpenAI from 'openai';

const IMAGE_MODEL = 'gpt-image-2' as const;

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
  const res = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt: params.prompt,
    n,
    size: '1024x1536',
    quality,
    output_format: 'png',
  });

  const rows = res.data ?? [];
  const b64List = rows.map((img, i) => {
    if (!img.b64_json) {
      throw new Error(`OpenAI image response missing b64_json at index ${i}`);
    }
    return img.b64_json;
  });
  return { b64List, model: IMAGE_MODEL };
}
