import { getModelById } from '@/lib/data/models';
import { MAX_MANUSCRIPT_TOKENS } from '@/lib/constants';

const FALLBACK_EDITORIAL_MODEL = 'claude-sonnet-4-6-thinking-high';

export type EditorialManuscriptGateFailure = { ok: false; status: 400; error: string };

export type EditorialManuscriptGateSuccess = {
  ok: true;
  modelId: string;
  modelSwitched: boolean;
  switchMessage: string;
};

export type EditorialManuscriptGateResult = EditorialManuscriptGateFailure | EditorialManuscriptGateSuccess;

/**
 * Shared manuscript sizing + model fallback logic for prose editorial and editorial-issues (structured queue).
 */
export function gateEditorialManuscriptContext(params: {
  requestedModelId: string | undefined;
  defaultStageModelId: string;
  manuscript: string;
  nicheReference?: unknown;
  charactersReference?: unknown;
  endingReference?: unknown;
  structureReference?: unknown;
}): EditorialManuscriptGateResult {
  const manuscript = params.manuscript;
  if (!manuscript || typeof manuscript !== 'string' || manuscript.trim().length === 0) {
    return {
      ok: false,
      status: 400,
      error:
        'Manuscript content is required for editorial analysis. Ensure you have approved chapters with content.',
    };
  }

  const estimatedManuscriptTokens = Math.ceil(manuscript.length / 4);
  const referenceDocsLength = [
    params.nicheReference,
    params.charactersReference,
    params.endingReference,
    params.structureReference,
  ]
    .filter(Boolean)
    .reduce<number>((sum, doc) => sum + String(doc as string).length, 0);
  const estimatedReferenceTokens = Math.ceil(referenceDocsLength / 4);
  const estimatedPromptOverhead = 2000;
  const estimatedTotalTokens = estimatedManuscriptTokens + estimatedReferenceTokens + estimatedPromptOverhead;

  let modelId = params.requestedModelId || params.defaultStageModelId;
  let modelSwitched = false;
  let switchMessage = '';

  const selectedModelConfig = getModelById(modelId);
  const selectedMaxContext = selectedModelConfig?.maxContextTokens || 128000;
  const fallbackModelConfig = getModelById(FALLBACK_EDITORIAL_MODEL);
  const fallbackMaxContext = fallbackModelConfig?.maxContextTokens || 200000;

  if (
    estimatedTotalTokens > selectedMaxContext &&
    fallbackMaxContext > selectedMaxContext &&
    estimatedTotalTokens <= fallbackMaxContext
  ) {
    const selectedName = selectedModelConfig?.name || modelId;
    const fallbackName = fallbackModelConfig?.name || FALLBACK_EDITORIAL_MODEL;
    modelId = FALLBACK_EDITORIAL_MODEL;
    modelSwitched = true;
    const manuscriptWordCount = Math.ceil(manuscript.length / 5);
    switchMessage = `Your manuscript (approximately ${manuscriptWordCount.toLocaleString()} words, ${estimatedTotalTokens.toLocaleString()} tokens) exceeds ${selectedName}'s context limit (${selectedMaxContext.toLocaleString()} tokens). We've automatically switched to ${fallbackName}, which supports up to ${fallbackMaxContext.toLocaleString()} tokens, to complete this editorial pass.`;
  }

  const currentModelConfig = getModelById(modelId);
  const modelContextTokens = currentModelConfig?.maxContextTokens || 128000;
  const effectiveMaxTokens = Math.min(modelContextTokens, MAX_MANUSCRIPT_TOKENS);

  if (estimatedTotalTokens > effectiveMaxTokens) {
    const manuscriptWordCount = Math.ceil(manuscript.length / 5);
    const maxWordsSupported = Math.floor(
      (effectiveMaxTokens - estimatedReferenceTokens - estimatedPromptOverhead) * (4 / 5)
    );
    return {
      ok: false,
      status: 400,
      error:
        `Manuscript is too long for editorial review.\n\n` +
        `• Your manuscript: ~${manuscriptWordCount.toLocaleString()} words (${estimatedTotalTokens.toLocaleString()} tokens)\n` +
        `• Maximum supported: ~${maxWordsSupported.toLocaleString()} words (${effectiveMaxTokens.toLocaleString()} tokens)\n\n` +
        `Shorten via outlines, review in batches, or focus chapters for this pass.`,
    };
  }

  const warningThreshold = effectiveMaxTokens * 0.8;
  if (estimatedTotalTokens > warningThreshold) {
    console.warn('[API] Manuscript approaching context limit:', {
      estimatedTotalTokens,
      warningThreshold,
      effectiveMaxTokens,
      model: modelId,
    });
  }

  console.log('[API] Editorial manuscript gate:', {
    modelId,
    modelSwitched,
    manuscriptTokens: estimatedManuscriptTokens,
    estimatedTotalTokens,
    effectiveMaxTokens,
  });

  return { ok: true, modelId, modelSwitched, switchMessage };
}
