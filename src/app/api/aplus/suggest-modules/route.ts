import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { APLUS_MODULES } from '@/lib/aplus/moduleCatalog';
import { summarizeStyleReferencesForPrompt } from '@/lib/cover/describeStyleReferences';
import { parseProjectStyleReferences } from '@/lib/cover/styleReferences';
import * as dbq from '@/lib/db/queries';
import type { APlusModuleType } from '@/types';

export const maxDuration = 60;

const BodySchema = z.object({ projectId: z.string().uuid() });

const MODULE_IDS = APLUS_MODULES.map((m) => m.id) as APlusModuleType[];

function parseModulesFromModelJson(raw: string): APlusModuleType[] {
  try {
    const parsed = JSON.parse(raw) as { modules?: unknown };
    const arr = parsed.modules;
    if (!Array.isArray(arr)) return [];
    const out: APlusModuleType[] = [];
    const allowed = new Set<string>(MODULE_IDS);
    for (const x of arr) {
      if (typeof x === 'string' && allowed.has(x)) {
        out.push(x as APlusModuleType);
      }
    }
    return Array.from(new Set(out)).slice(0, 5);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }
    const { projectId } = parsed.data;
    const project = await dbq.getProject(projectId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const catalog = APLUS_MODULES.map((m) => `- ${m.id}: ${m.label} — ${m.purpose}`).join('\n');
    const refs = parseProjectStyleReferences(project.aPlusStyleReferencesJson);
    let exampleSummary = '';
    if (refs.length > 0) {
      exampleSummary = await summarizeStyleReferencesForPrompt(refs, 'aplus').catch(() => '');
    }

    if (!process.env.OPENAI_API_KEY?.trim()) {
      const fallback: APlusModuleType[] = ['hero-banner', 'character-spotlight', 'quote-review'];
      return NextResponse.json({ suggestedModules: fallback, usedModel: null });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const userBlock = [
      `Title: ${project.title ?? 'Untitled'}`,
      `Genre: ${project.genre}`,
      project.niche?.trim() ? `Niche: ${project.niche}` : '',
      exampleSummary.trim() ? `Summarised user A+ example screenshots:\n${exampleSummary.trim()}` : 'No example screenshots were uploaded.',
      '',
      'Catalog (pick 2–4 module ids that best match the campaign):',
      catalog,
      '',
      'Return JSON only: {"modules":["hero-banner",...]} with 2–4 ids from the catalog.',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You select Amazon A+ module types for fiction book detail pages. Output strict JSON with key "modules" only.',
        },
        { role: 'user', content: userBlock },
      ],
    });

    const text = res.choices[0]?.message?.content?.trim() ?? '{}';
    const suggestedModules = parseModulesFromModelJson(text);
    const finalList =
      suggestedModules.length >= 2
        ? suggestedModules
        : exampleSummary.trim()
          ? (['hero-banner', 'world-spotlight', 'quote-review'] as APlusModuleType[])
          : (['hero-banner', 'character-spotlight', 'quote-review'] as APlusModuleType[]);

    return NextResponse.json({ suggestedModules: finalList, usedModel: 'gpt-4o-mini' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Suggestion failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
