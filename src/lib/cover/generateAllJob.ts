import { randomUUID } from 'crypto';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import * as dbq from '@/lib/db/queries';
import { compositeFullWrapToPng, dominantHexFromCoverB64, rasterPngTopdfSheet, renderSpinePng } from '@/lib/cover/fullWrapComposite';
import { defaultThirdZones } from '@/lib/cover/fullWrapZones';
import { estimateWrapDimensionsFromTrimSize, getKdpTrimSizeById } from '@/lib/cover/kdpTrimSizes';
import { generateOpenAICoverImages } from '@/lib/cover/openaiCoverImages';
import { formatCanonSummaryForCoverPrompt } from '@/lib/marketing/canonicalContext';
import { summarizeStyleReferencesForPrompt } from '@/lib/cover/describeStyleReferences';
import { parseProjectStyleReferences } from '@/lib/cover/styleReferences';
import { BACK_COVER_EXACT_TEXT_LINE, COVER_ARCHETYPES, COVER_GENERATION_SYSTEM } from '@/lib/prompts/covers';
import type { CoverFullWrapDocument, CoverGenerationJobInput, CoverGenerationJobResult, CoverImagePayload } from '@/types';

export async function processCoverGenerationJob(jobId: string): Promise<void> {
  const job = await dbq.getCoverGenerationJob(jobId);
  if (!job) return;
  const project = await dbq.getProject(job.projectId);
  if (!project) {
    await dbq.updateCoverGenerationJob(jobId, { status: 'failed', progressStage: 'failed', error: 'Project not found' });
    return;
  }

  const archetype = COVER_ARCHETYPES.find((a) => a.id === job.input.archetypeId);
  if (!archetype) {
    await dbq.updateCoverGenerationJob(jobId, { status: 'failed', progressStage: 'failed', error: 'Unknown archetype selected.' });
    return;
  }

  try {
    await dbq.updateCoverGenerationJob(jobId, {
      status: 'running_front',
      progressStage: 'running_images:openai_generate',
      error: null,
    });
    await dbq.updateProject(project.id, { coverGenerationStatus: 'in-progress', paperbackGenerationStatus: 'in-progress' });

    const runId = randomUUID();
    const documents = await dbq.getProjectDocuments(project.id);
    const canonSummary = formatCanonSummaryForCoverPrompt(documents).trim();

    const authorDisplay = job.input.authorName.trim() || project.authorName?.trim() || 'Author';

    const coverRefs = parseProjectStyleReferences(project.coverStyleReferencesJson);
    let styleReferenceSummary = '';
    if (coverRefs.length > 0) {
      styleReferenceSummary = await summarizeStyleReferencesForPrompt(coverRefs, 'cover').catch(() => '');
    }

    const frontPrompt = buildFrontPrompt({
      archetypeId: archetype.id,
      archetypeName: archetype.name,
      genre: project.genre,
      title: project.title ?? 'Untitled',
      subtitle: project.subtitle,
      tagline: project.tagline,
      authorName: authorDisplay,
      amazonDescription: project.amazonDescription ?? '',
      canonSummary: canonSummary || undefined,
      styleReferenceSummary: styleReferenceSummary.trim() || undefined,
    });
    const backPrompt = buildBackPrompt({
      archetypeName: archetype.name,
      genre: project.genre,
      title: project.title ?? 'Untitled',
      authorName: authorDisplay,
      blurbExact: (project.blurb ?? '').trim(),
      amazonTone: project.amazonDescription ?? '',
      canonSummary: canonSummary || undefined,
      styleReferenceSummary: styleReferenceSummary.trim() || undefined,
    });

    // Front and back are independent OpenAI calls — run them in parallel to
    // roughly halve the slowest path (each high-quality 1024x1536 call is 2–3 min).
    // We deliberately avoid intermediate progressStage writes inside the parallel
    // phase to prevent two concurrent fibres from racing each other's update.
    const [frontResult, backResult] = await Promise.all([
      generateWithSingleRetry({ prompt: frontPrompt, n: 1, quality: 'high' }),
      generateWithSingleRetry({ prompt: backPrompt, n: 1, quality: 'high' }),
    ]);
    const frontB64 = frontResult.b64List[0];
    const backB64 = backResult.b64List[0];

    await dbq.updateCoverGenerationJob(jobId, {
      status: 'running_back',
      progressStage: 'running_images:save_documents',
    });

    const [frontDocId, backDocId] = await Promise.all([
      createCoverImageDoc({
        projectId: project.id,
        runId,
        archetypeId: archetype.id,
        prompt: frontPrompt,
        imageData: frontB64,
        surface: 'front',
        approved: true,
      }),
      createCoverImageDoc({
        projectId: project.id,
        runId,
        archetypeId: archetype.id,
        prompt: backPrompt,
        imageData: backB64,
        surface: 'back',
        approved: true,
      }),
    ]);

    await dbq.updateCoverGenerationJob(jobId, {
      status: 'running_wrap',
      progressStage: 'running_wrap:init',
      result: { frontDocumentId: frontDocId, backDocumentId: backDocId },
    });

    const wrapResult = await generateWrapForJob(project.id, {
      frontB64,
      backB64,
      frontDocId,
      backDocId,
      input: job.input,
      title: project.title ?? 'Untitled',
      authorName: authorDisplay,
    });

    const result: CoverGenerationJobResult = {
      frontDocumentId: frontDocId,
      backDocumentId: backDocId,
      wrapDocumentId: wrapResult.wrapDocId,
      resolvedCanvasWidth: wrapResult.canvasWidth,
      resolvedCanvasHeight: wrapResult.canvasHeight,
      resolvedSizingSource: wrapResult.sizingSource,
    };
    await dbq.updateCoverGenerationJob(jobId, { status: 'finalizing', progressStage: 'finalizing:update_project', result });

    await dbq.updateProject(project.id, {
      authorName: job.input.authorName,
      approvedCoverImageId: frontDocId,
      approvedBackCoverImageId: backDocId,
      coverGenerationStatus: 'complete',
      paperbackGenerationStatus: 'complete',
      coverTrimSizeId: job.input.trimSizeId,
      kdpTemplateImageData: job.input.templateUpload?.mimeType.startsWith('image/')
        ? job.input.templateUpload.base64Data
        : project.kdpTemplateImageData ?? null,
    });

    await dbq.updateCoverGenerationJob(jobId, { status: 'succeeded', progressStage: 'succeeded', result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Job failed';
    const latest = await dbq.getCoverGenerationJob(jobId);
    const partial = latest?.result?.frontDocumentId && latest?.result?.backDocumentId;
    await dbq.updateCoverGenerationJob(jobId, {
      status: partial ? 'partially_succeeded' : 'failed',
      progressStage: partial ? 'partially_succeeded' : 'failed',
      error: message,
      result: latest?.result ? { ...latest.result, error: message } : { error: message },
    });
  }
}

export async function retryWrapForJob(jobId: string): Promise<void> {
  const job = await dbq.getCoverGenerationJob(jobId);
  if (!job) throw new Error('Job not found');
  if (!job.result?.frontDocumentId || !job.result?.backDocumentId) {
    throw new Error('Cannot retry wrap without front and back documents');
  }
  const project = await dbq.getProject(job.projectId);
  if (!project) throw new Error('Project not found');

  const front = await dbq.getDocument(job.result.frontDocumentId);
  const back = await dbq.getDocument(job.result.backDocumentId);
  if (!front?.content || !back?.content) throw new Error('Front/back documents missing');
  const frontPayload = JSON.parse(front.content) as CoverImagePayload;
  const backPayload = JSON.parse(back.content) as CoverImagePayload;

  await dbq.updateCoverGenerationJob(jobId, { status: 'running_wrap', progressStage: 'running_wrap:retry_init', error: null });
  const wrapResult = await generateWrapForJob(project.id, {
    frontB64: frontPayload.imageData,
    backB64: backPayload.imageData,
    frontDocId: job.result.frontDocumentId,
    backDocId: job.result.backDocumentId,
    input: job.input,
    title: project.title ?? 'Untitled',
    authorName: job.input.authorName,
  });
  await dbq.updateCoverGenerationJob(jobId, {
    status: 'succeeded',
    progressStage: 'succeeded',
    result: {
      ...job.result,
      wrapDocumentId: wrapResult.wrapDocId,
      resolvedCanvasWidth: wrapResult.canvasWidth,
      resolvedCanvasHeight: wrapResult.canvasHeight,
      resolvedSizingSource: wrapResult.sizingSource,
      error: undefined,
    },
  });
}

/** Manual POST /api/cover/full-wrap uses the same thirds-from-template-metadata approach (see route). */
async function generateWrapForJob(
  projectId: string,
  args: {
    frontB64: string;
    backB64: string;
    frontDocId: string;
    backDocId: string;
    input: CoverGenerationJobInput;
    title: string;
    authorName: string;
  }
): Promise<{ wrapDocId: string; canvasWidth: number; canvasHeight: number; sizingSource: 'uploaded-template' | 'trim-size-estimate' | 'fallback-default' }> {
  const dims = await withWrapContext(
    'resolve_wrap_dimensions',
    async () => resolveWrapDimensions(args.input)
  );
  const zones = defaultThirdZones(dims.canvasWidth, dims.canvasHeight);
  const spineBg = await withWrapContext('extract_spine_colour', async () =>
    dominantHexFromCoverB64(args.frontB64)
  );
  const spinePng = await withWrapContext('render_spine_png', async () =>
    renderSpinePng(zones.spineZone.width, zones.spineZone.height, {
      titleText: args.title,
      authorText: args.authorName,
      seriesText: null,
      backgroundColour: spineBg,
      textColour: '#ffffff',
    })
  );
  const wrapPng = await withWrapContext('compose_full_wrap_png', async () =>
    compositeFullWrapToPng({
      canvasWidth: dims.canvasWidth,
      canvasHeight: dims.canvasHeight,
      backZone: zones.backZone,
      spineZone: zones.spineZone,
      frontZone: zones.frontZone,
      backImageB64: args.backB64,
      spinePngBuffer: spinePng,
      frontImageB64: args.frontB64,
    })
  );
  await withWrapContext('raster_to_pdf_sheet', async () =>
    rasterPngTopdfSheet(wrapPng, dims.canvasWidth, dims.canvasHeight)
  );

  const wrapDoc: CoverFullWrapDocument = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    frontCoverImageId: args.frontDocId,
    backCoverImageId: args.backDocId,
    spineConfig: {
      titleText: args.title,
      authorText: args.authorName,
      seriesText: null,
      backgroundColour: spineBg,
      textColour: '#ffffff',
      logoImageData: null,
    },
    templateSource: {
      uploadedAt: new Date().toISOString(),
      detectedDimensions: {
        canvasWidth: dims.canvasWidth,
        canvasHeight: dims.canvasHeight,
        frontZone: zones.frontZone,
        backZone: zones.backZone,
        spineZone: zones.spineZone,
        bleedPx: 0,
      },
      dimensionsUserConfirmed: false,
    },
    exportedAt: new Date().toISOString(),
    exportFilename: `full-wrap-${projectId.slice(0, 8)}.pdf`,
  };
  const wrapDocId = await dbq.createDocument({
    projectId,
    type: 'cover-full-wrap',
    content: JSON.stringify(wrapDoc),
    version: 1,
    approved: true,
  });
  return {
    wrapDocId,
    canvasWidth: dims.canvasWidth,
    canvasHeight: dims.canvasHeight,
    sizingSource: dims.source,
  };
}

async function createCoverImageDoc(params: {
  projectId: string;
  runId: string;
  archetypeId: string;
  prompt: string;
  imageData: string;
  surface: 'front' | 'back';
  approved: boolean;
}): Promise<string> {
  const payload: CoverImagePayload = {
    schemaVersion: 1,
    runId: params.runId,
    archetypeId: params.archetypeId,
    highClickEnabled: false,
    promptUsed: params.prompt,
    variantIndex: 0,
    parentImageId: null,
    refinementRequest: null,
    version: 1,
    surface: params.surface,
    status: params.approved ? 'approved' : 'candidate',
    imageData: params.imageData,
    generatedAt: new Date().toISOString(),
    refinementHistory: [],
  };
  return dbq.createDocument({
    projectId: params.projectId,
    type: 'cover-image',
    content: JSON.stringify(payload),
    version: 1,
    approved: params.approved,
  });
}

function buildFrontPrompt(input: {
  archetypeId: string;
  archetypeName: string;
  genre: string;
  title: string;
  subtitle?: string;
  tagline?: string;
  authorName: string;
  amazonDescription: string;
  canonSummary?: string;
  styleReferenceSummary?: string;
}): string {
  const description = trimForPrompt(input.amazonDescription);
  const lines = [
    COVER_GENERATION_SYSTEM,
    '',
    `Design a commercial ${input.genre} front cover using archetype ${input.archetypeId} (${input.archetypeName}).`,
    `Book title (exact text): "${input.title}".`,
    input.subtitle?.trim()
      ? `Subtitle — include on cover only if readable at thumbnail size (exact text): "${input.subtitle.trim()}".`
      : null,
    input.tagline?.trim()
      ? `Tagline — small type only if legible (exact text): "${input.tagline.trim()}".`
      : null,
    `Author name (exact text): "${input.authorName}".`,
    'Retail / discovery context (tone and promise — use with canon below):',
    description,
    input.canonSummary?.trim()
      ? `\nApproved canon (characters, symbolism, promises — align imagery; do not contradict):\n${input.canonSummary.trim()}`
      : null,
    input.styleReferenceSummary?.trim()
      ? `\nUser reference covers (palette, layout mood — synthesise originals; never copy titles/trademarks/likenesses):\n${input.styleReferenceSummary.trim()}`
      : null,
    'Prioritize thumbnail readability, clear focal hierarchy, and typographic legibility.',
  ].filter((x): x is string => x != null && x !== '');
  return lines.join('\n');
}

function buildBackPrompt(input: {
  archetypeName: string;
  genre: string;
  title: string;
  authorName: string;
  blurbExact: string;
  amazonTone: string;
  canonSummary?: string;
  styleReferenceSummary?: string;
}): string {
  const tone = trimForPrompt(input.amazonTone);
  const lines = [
    COVER_GENERATION_SYSTEM,
    '',
    `Design a full-bleed ${input.genre} BACK COVER panel that visually matches the ${input.archetypeName} front cover style.`,
    `Book title (exact text): "${input.title}".`,
    `Author name (exact text): "${input.authorName}".`,
    '',
    'BACK-COVER BODY TYPOGRAPHY — use this approved back-of-book blurb verbatim (exact wording; line breaks allowed for fit):',
    input.blurbExact.trim(),
    '',
    tone.length
      ? `Amazon product description (retail tone reference only — do not replace blurb):\n${tone}`
      : null,
    input.canonSummary?.trim()
      ? `\nApproved canon for visual cohesion:\n${input.canonSummary.trim()}`
      : null,
    input.styleReferenceSummary?.trim()
      ? `\nFront-cover neighbourhood style cues from user references — keep spine-to-spine cohesion:\n${input.styleReferenceSummary.trim()}`
      : null,
    BACK_COVER_EXACT_TEXT_LINE,
  ].filter((x): x is string => x != null && x !== '');
  return lines.join('\n');
}

function trimForPrompt(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > 3200 ? `${cleaned.slice(0, 3200)}...` : cleaned;
}

async function resolveWrapDimensions(input: CoverGenerationJobInput): Promise<{
  canvasWidth: number;
  canvasHeight: number;
  source: 'uploaded-template' | 'trim-size-estimate' | 'fallback-default';
}> {
  const templateUpload = input.templateUpload;
  if (templateUpload?.base64Data) {
    const buffer = Buffer.from(templateUpload.base64Data, 'base64');
    if (templateUpload.mimeType === 'application/pdf') {
      const pdf = await PDFDocument.load(buffer);
      const firstPage = pdf.getPage(0);
      const size = firstPage.getSize();
      return {
        canvasWidth: clampDimension(Math.round(size.width * 4)),
        canvasHeight: clampDimension(Math.round(size.height * 4)),
        source: 'uploaded-template',
      };
    }
    if (templateUpload.mimeType.startsWith('image/')) {
      const meta = await sharp(buffer).metadata();
      if (!meta.width || !meta.height) throw new Error('Unable to read uploaded template dimensions.');
      return {
        canvasWidth: clampDimension(meta.width),
        canvasHeight: clampDimension(meta.height),
        source: 'uploaded-template',
      };
    }
  }
  const trim = getKdpTrimSizeById(input.trimSizeId);
  if (trim) {
    const estimated = estimateWrapDimensionsFromTrimSize({ trimWidthIn: trim.widthIn, trimHeightIn: trim.heightIn });
    return {
      canvasWidth: clampDimension(estimated.canvasWidth),
      canvasHeight: clampDimension(estimated.canvasHeight),
      source: 'trim-size-estimate',
    };
  }
  return { canvasWidth: 3000, canvasHeight: 2000, source: 'fallback-default' };
}

function clampDimension(value: number): number {
  return Math.max(600, Math.min(9000, value));
}

async function withWrapContext<T>(step: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    throw new Error(`wrap:${step}: ${msg}`);
  }
}

async function generateWithSingleRetry(
  params: { prompt: string; n: number; quality?: 'standard' | 'high' }
): Promise<{ b64List: string[]; model: string }> {
  try {
    return await generateOpenAICoverImages(params);
  } catch (e) {
    if (!isAbortLikeError(e)) {
      throw e;
    }
  }
  return generateOpenAICoverImages(params);
}

function isAbortLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /timed out|request was aborted|abort/i.test(error.message);
}
