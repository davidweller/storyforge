import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { summarizeStyleReferencesForPrompt } from '@/lib/cover/describeStyleReferences';
import { mergeTrustedAPlusImagePrompt } from '@/lib/aplus/serverTrustedPrompt';
import { parseProjectStyleReferences } from '@/lib/cover/styleReferences';
import { generateOpenAICoverImages } from '@/lib/cover/openaiCoverImages';
import * as dbq from '@/lib/db/queries';
import type { APlusImagePayload, APlusModuleType, APlusTextMode } from '@/types';

export const maxDuration = 300;

const ModuleSchema = z.object({
  moduleType: z.enum([
    'hero-banner',
    'character-spotlight',
    'world-spotlight',
    'trope-promise',
    'series-author-brand',
    'quote-review',
  ]),
  prompt: z.string().min(16).max(32_000),
  textMode: z.enum(['none', 'suggested', 'custom']),
  customText: z.string().max(300).optional(),
  suggestedText: z.string().max(300).optional(),
});

const BodySchema = z.object({
  projectId: z.string().uuid(),
  runId: z.string().min(8),
  modules: z.array(ModuleSchema).min(1).max(10),
  n: z.number().int().min(1).max(10).optional().default(2),
  quality: z.enum(['standard', 'high']).optional().default('high'),
});

type ResultRow = {
  moduleType: APlusModuleType;
  documentIds: string[];
  images: string[];
  error?: string;
};

function enrichPromptWithTextDirective(
  prompt: string,
  textMode: APlusTextMode,
  customText?: string,
  suggestedText?: string
): string {
  if (textMode === 'none') {
    return `${prompt.trim()}\n\nTypography instruction: Do not render any readable text in the image.`;
  }
  if (textMode === 'custom') {
    return `${prompt.trim()}\n\nTypography instruction: Render this exact in-image text with no paraphrasing: "${(customText ?? '').trim()}".`;
  }
  if (suggestedText?.trim()) {
    return `${prompt.trim()}\n\nTypography instruction: If text appears, use this copy: "${suggestedText.trim()}".`;
  }
  return `${prompt.trim()}\n\nTypography instruction: Keep any in-image text minimal and highly legible.`;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }
    const { projectId, runId, modules, n, quality } = parsed.data;
    const project = await dbq.getProject(projectId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const documents = await dbq.getProjectDocuments(projectId);
    const aplusRefs = parseProjectStyleReferences(project.aPlusStyleReferencesJson);
    let referenceSummary = '';
    if (aplusRefs.length > 0) {
      referenceSummary = await summarizeStyleReferencesForPrompt(aplusRefs, 'aplus').catch(() => '');
    }

    const results: ResultRow[] = [];
    await Promise.all(
      modules.map(async (entry) => {
        const drafted = enrichPromptWithTextDirective(
          entry.prompt,
          entry.textMode,
          entry.customText,
          entry.suggestedText
        );
        const promptUsed = mergeTrustedAPlusImagePrompt({
          clientPrompt: drafted,
          project,
          documents,
          referenceSummary: referenceSummary.trim() || null,
        });
        try {
          const { b64List } = await generateOpenAICoverImages({ prompt: promptUsed, n, quality });
          const documentIds: string[] = [];
          let variantIndex = 0;
          for (const b64 of b64List) {
            const payload: APlusImagePayload = {
              schemaVersion: 1,
              runId,
              moduleType: entry.moduleType,
              promptUsed,
              promptOverridden: true,
              textMode: entry.textMode,
              customText: entry.customText?.trim() || null,
              suggestedText: entry.suggestedText?.trim() || null,
              variantIndex,
              parentImageId: null,
              refinementRequest: null,
              version: 1,
              status: 'candidate',
              imageData: b64,
              generatedAt: new Date().toISOString(),
              refinementHistory: [],
            };
            const id = await dbq.createDocument({
              projectId,
              type: 'a-plus-module',
              content: JSON.stringify(payload),
              version: 1,
              approved: false,
            });
            documentIds.push(id);
            variantIndex += 1;
          }
          results.push({ moduleType: entry.moduleType, documentIds, images: b64List });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Image generation failed';
          const policy =
            /content policy|safety|blocked|declined|400/i.test(msg)
              ? 'The image model declined this prompt. Try reducing text density or revising subject details.'
              : msg;
          results.push({
            moduleType: entry.moduleType,
            documentIds: [],
            images: [],
            error: policy,
          });
        }
      })
    );

    return NextResponse.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'A+ generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
