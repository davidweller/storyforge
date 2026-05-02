/**
 * End-to-end fiction pipeline exercise: "The Cartographer's Lie"
 * POSTs to /api/generate; validates Zod schemas; logs token usage plus API/count warnings.
 *
 * Scenario checklist order (user intent): Story Bible → endings → titles → outline → scenes → prose → continuity → QA → editorial → revision.
 * API constraint: `story-bible` requires parsable chapter outlines — this script runs `chapter-outlines` first as a prerequisite and logs that drift.
 *
 * Usage: npx tsx scripts/e2e-cartographer-lie.ts
 * Optional: E2E_API_BASE=https://host:port
 * Optional: E2E_STRICT_CARDINALITY=1 (adds strictCardinality + fails if ending/title counts drift from scenario)
 */
import {
  parseStoryBible,
  parseEndingConcepts,
  parseTitleOptions,
  parseChapterOutlines,
  parseChapterSummary,
  parseChapterScenePlan,
  parseChapterSceneProseOutput,
  parseChapterEvaluation,
  parseRevisionQueue,
  type ChapterOutline,
} from '../src/lib/generation/schemas';

const BASE_URL = process.env.E2E_API_BASE?.replace(/\/$/, '') || 'http://localhost:3000';
/** When set to `1`, POSTs include `strictCardinality`; ending/title parse counts must match the scenario payload. */
const STRICT_CARDINALITY = process.env.E2E_STRICT_CARDINALITY === '1';
const PROJECT_ID = `e2e-cartographer-${Date.now()}`;

const GENRE = 'Literary thriller';
const PREMISE = `The Cartographer's Lie — a disgraced mapmaker in 1890s Vienna discovers a conspiracy hidden in civic blueprints. 
Told in close third-person past tense with a melancholic, precise narrative voice; historical texture and interiority over spectacle.`;

const STUB_NICHE = `Reader: adult fiction readers who like elegant, paranoid historical thrillers (e.g. séance-era Vienna, archives, bureaucracy). 
Emotional promise: moral stain, brittle pride, the city as a palimpsest of power. 
Tropes to lean on: unreliable institutions, artisan expertise, clues in documents. Avoid: modern diction, steampunk gadgetry, gratuitous violence.`;

const STUB_STRUCTURE_FIVE = `This project is intentionally a **5-chapter literary thriller novella** (not 20–30 chapters). Map one major beat per chapter:

1. Opening Image / ordinary world — disgrace, exile into archival work; first odd detail on a blueprint.
2. Debate / investigation turns active — breaches trust; discovers partial pattern.
3. Midpoint — conspiracy scope widens; personal cost lands.
4. Bad Guys Close In — surveillance or institutional pressure; moral compromise.
5. Finale / revelation — confrontation with truth about maps and power; bittersweet resolution aligned with literary thriller tone.

Total manuscript budget stays within standard novella pacing (~15–22k words across 5 chapters unless otherwise constrained).`;

const STUB_CHARACTERS = `Protagonist: Elias Wexler — disgraced cartographer, late 30s, meticulous, socially thin-skinned.
Antagonistic force: civic survey office / patrons who treat maps as propaganda.
Supporting: archivist clerk; estranged mentor figure.`;

const STUB_ENDING = `Ending direction (working): Elias exposes or buries the truth in a way that costs him remaining professional standing but preserves a private moral line; conspiracy is partially institutional, not melodramatic supervillainy.`;

const warnings: string[] = [];

function warn(msg: string) {
  warnings.push(msg);
  console.warn(`⚠ WARN: ${msg}`);
}

type GenRes = { content: string; tokensUsed: number; model?: string; warnings?: string[] };

type GenReq = Record<string, unknown>;

async function post(stage: string, data: Record<string, unknown>): Promise<GenRes> {
  const payload: GenReq = {
    stage,
    data,
    projectId: PROJECT_ID,
    usageSource: 'manual-stage',
  };
  if (STRICT_CARDINALITY) payload.strictCardinality = true;

  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as GenRes & { error?: string; details?: unknown };
  if (!res.ok) {
    throw new Error(`${stage} HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  if (body.error) throw new Error(`${stage}: ${body.error}`);
  return {
    content: body.content,
    tokensUsed: body.tokensUsed ?? 0,
    model: body.model,
    warnings: body.warnings,
  };
}

function canonGate(stageLabel: string, schemaOk: boolean, extraWarnings: string[]) {
  const extras = extraWarnings.filter(Boolean);
  console.log(
    `\n  [Canon gate: ${stageLabel}] schemaValidated=${schemaOk}` +
      (extras.length ? ` | unresolved: ${extras.join(' | ')}` : ' | no blocking warnings')
  );
  const block = extras.some((w) => /truncat|repair failed|parse failed/i.test(w));
  if (block || !schemaOk) {
    warn(`Defer canon approval for "${stageLabel}" until issues are cleared.`);
  }
}

let cumulative = 0;

function logStage(name: string, r: GenRes, meta?: Record<string, unknown>) {
  cumulative += r.tokensUsed;
  console.log(`\n── ${name} ──`);
  console.log(`tokens: ${r.tokensUsed} | model: ${r.model ?? '?'} | cumulative: ${cumulative}`);
  if (r.warnings?.length) {
    console.log(`API structured-output warnings (${r.warnings.length}):`);
    r.warnings.forEach((w) => console.log(`   - ${w}`));
    r.warnings.forEach((w) => warn(`[API] ${name}: ${w}`));
  }
  if (meta) console.log('meta:', JSON.stringify(meta, null, 2));
}

async function main() {
  console.log(`E2E base: ${BASE_URL} | projectId: ${PROJECT_ID}`);
  console.log(`E2E_STRICT_CARDINALITY: ${STRICT_CARDINALITY ? 'ON' : 'off'}\n`);
  warn(
    'Workflow drift: checklist lists Story Bible before chapter outline; API requires outlines first — running chapter-outlines as prerequisite.'
  );

  const DOCUMENT_TYPES_ORDER = ['genre', 'niche', 'ending', 'characters', 'structure', 'chapter-outlines'] as const;
  type DerivedDocKey = (typeof DOCUMENT_TYPES_ORDER)[number];
  const syntheticDerivedFrom = (refs: Partial<Record<DerivedDocKey, string>> = {}) =>
    DOCUMENT_TYPES_ORDER.map((documentType) => ({
      documentType,
      documentId: refs[documentType] ?? `e2e-${documentType}`,
      version: 1,
      updatedAt: new Date().toISOString(),
    }));

  // ── 0. Chapter outlines (API prerequisite — user scenario lists outline after endings/titles; one LLM-less stub suffices here.)
  const outlinesRes = await post('chapter-outlines', {
    genre: GENRE,
    premise: PREMISE,
    structureReference: STUB_STRUCTURE_FIVE,
    charactersReference: STUB_CHARACTERS,
    endingReference: `${STUB_ENDING}\n\n(Scratch direction only — canonical ending concepts follow Story Bible.)`,
    nicheReference: STUB_NICHE,
    genreResearch: 'Market: upmarket / book-club thriller crossover; austere prose welcome.',
  });
  logStage('chapter-outlines (prerequisite)', outlinesRes);

  let chaptersOutline = parseChapterOutlines(outlinesRes.content).sort((a, b) => a.chapterNumber - b.chapterNumber);
  if (!chaptersOutline.length) throw new Error('Outline parse yielded no chapters');

  canonGate(
    'chapter-outlines',
    chaptersOutline.length > 0,
    chaptersOutline.length === 5
      ? []
      : [
          chaptersOutline.length < 5
            ? `expected 5 chapters, got ${chaptersOutline.length}`
            : `expected 5 primary chapters for scenario trim; outline has ${chaptersOutline.length}`,
        ]
  );

  if (chaptersOutline.length !== 5) {
    warn(
      `Outline chapter count is ${chaptersOutline.length}; prompts often target higher counts; scenario uses 5. Trimming extras or flagging shortage.`
    );
    if (chaptersOutline.length > 5) chaptersOutline = chaptersOutline.slice(0, 5);
  }
  const ch1Outline = chaptersOutline.find((c) => c.chapterNumber === 1);
  const ch2Outline = chaptersOutline.find((c) => c.chapterNumber === 2);
  if (!ch1Outline || !ch2Outline) throw new Error('Missing chapter 1 or 2 in outline payload');

  const ch1GoalsWeak = !(ch1Outline.beatReference?.trim()) || !(ch1Outline.sceneGoal?.trim());
  if (ch1GoalsWeak)
    warn('Chapter 1 outline missing beatReference or sceneGoal after parse (beat goals expected per prompt).');

  // ── 1. Story Bible (scenario step 1; requires outlinesReference per API) ──
  const sbRes = await post('story-bible', {
    title: `The Cartographer's Lie`,
    premise: PREMISE,
    genre: GENRE,
    niche: '',
    research: '',
    derivedFrom: syntheticDerivedFrom({ 'chapter-outlines': 'e2e-outlines-doc' }),
    genreResearch:
      'Literary thriller: interior character study + moral conspiracy; emphasis on precise sensory detail and restrained tension.',
    nicheReference: STUB_NICHE,
    endingReference: `${STUB_ENDING}\n${JSON.stringify(
      chaptersOutline.slice(0, 2).map((c) => ({ ch: c.chapterNumber, title: c.title, goal: c.sceneGoal })),
      null,
      2
    )}`,
    endingChoice: '',
    charactersReference: STUB_CHARACTERS,
    structureReference: STUB_STRUCTURE_FIVE,
    chapterOutlinesReference: outlinesRes.content,
  });
  logStage('1. story-bible', sbRes);
  let storyBibleJson: ReturnType<typeof parseStoryBible>;
  try {
    storyBibleJson = parseStoryBible(sbRes.content);
  } catch (e) {
    throw new Error(`Story Bible schema validation failed: ${e}`);
  }
  const sb = storyBibleJson.storyBible;
  canonGate('story-bible', true, sb.forbiddenChanges?.length ? [] : ['missing forbiddenChanges']);
  if (!sb.forbiddenChanges?.length) {
    warn('Story Bible has no forbiddenChanges (scenario asked for one hard forbidden change).');
  }
  const canonBrief = JSON.stringify(
    {
      voiceAndStyle: sb.voiceAndStyle,
      themes: sb.themes,
      forbiddenChanges: sb.forbiddenChanges,
      logline: sb.logline,
    },
    null,
    2
  );

  const charactersRef = `${STUB_CHARACTERS}\n\n(From Story Bible)\n${JSON.stringify(sb.characters ?? [], null, 2)}`;

  // ── 2. Ending concepts (structured JSON vs EndingConceptsOutputSchema — scenario expects 3; prompt asks for 8–10) ──
  const endRes = await post('ending', {
    genre: GENRE,
    premise: PREMISE,
    nicheReference: STUB_NICHE,
    endingConceptCount: 3,
  });
  logStage('2. ending concepts', endRes);
  const endings = parseEndingConcepts(endRes.content);
  if (!endings.length) throw new Error('No endings after parse');
  if (endings.length !== 3) {
    const msg = `Ending count ${endings.length}; scenario requires exactly 3.`;
    warn(msg);
    if (STRICT_CARDINALITY) throw new Error(msg);
  }
  const endingDocText = JSON.stringify({ endings: endings.slice(0, 3) }, null, 2);
  canonGate(
    'ending concepts',
    true,
    endings.length !== 3 && !STRICT_CARDINALITY ? ['count ≠ scenario (3)'] : []
  );
  // ── 3. Title options (structured TitleIdeasOutputSchema — scenario expects 5; prompt asks for 10) ──
  const titleRes = await post('title', {
    genre: GENRE,
    premise: PREMISE,
    assembledContext: `Story Bible voice/canon excerpt:\n${canonBrief}`,
    nicheReference: STUB_NICHE,
    structureReference: STUB_STRUCTURE_FIVE,
    endingReference: endingDocText.slice(0, 2800),
    charactersReference: charactersRef,
    titleCount: 5,
  });
  logStage('3. title ideas', titleRes);
  const titles = parseTitleOptions(titleRes.content);
  if (!titles.length) throw new Error('No titles after parse');
  if (titles.length !== 5) {
    const msg = `Title count ${titles.length}; scenario requires exactly 5.`;
    warn(`${msg} — using first five for parity: ${titles.slice(0, 5).join(' | ')}`);
    if (STRICT_CARDINALITY) throw new Error(msg);
  }
  canonGate(
    'title ideas',
    true,
    titles.length !== 5 && !STRICT_CARDINALITY ? [`scenario asked for 5 titles; parsed ${titles.length}`] : []
  );
  // ── 4. Chapter outline stage (canonical outline already validated as prerequisite `chapter-outlines`) ──
  console.log(
    `\n── 4. chapter outline (replay) ──\nUsing validated outline (${chaptersOutline.length} chapters) from prerequisite call — no regeneration.`
  );
  canonGate('chapter-outline', chaptersOutline.length === 5, ch1GoalsWeak ? ['Ch1 beats weak / empty beat fields'] : []);

  // ── 5. Scene cards for chapter 1 ──

  const outlinesDocMeta = {
    documentId: 'e2e-outlines-doc',
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  const scenePlanRes = await post('chapter-scene-plan', {
    genre: GENRE,
    chapterNumber: 1,
    outlinesSourceJson: JSON.stringify(outlinesDocMeta),
    outlineSliceJson: JSON.stringify(ch1Outline satisfies ChapterOutline),
    assembledContext: canonBrief,
  });
  logStage('5. chapter-scene-plan (Ch 1)', scenePlanRes);
  let scenePlan: ReturnType<typeof parseChapterScenePlan>;
  try {
    scenePlan = parseChapterScenePlan(scenePlanRes.content);
  } catch (e) {
    throw new Error(`Scene plan schema validation failed: ${e}`);
  }
  const scenes = [...scenePlan.scenePlan.scenes].sort((a, b) => a.order - b.order);
  if (scenes.length !== 3) {
    warn(`Scene card count for Ch1 is ${scenes.length}; scenario requested exactly 3. App prompt suggests 3–6 typical.`);
  }

  // ── 6. Chapter 1 prose (per scene) ──
  const segments: { sceneId: string; prose: string }[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const card = scenes[i];
    const pr = await post('chapter-scenes-prose', {
      genre: GENRE,
      chapterNumber: 1,
      chapterTitle: ch1Outline.title,
      sceneCard: card,
      assembledContext: canonBrief,
      neighborSummaryBefore: i > 0 ? segments[i - 1]!.prose.slice(0, 400) : undefined,
      neighborSummaryAfter:
        i < scenes.length - 1
          ? `${scenes[i + 1]!.purpose} (${scenes[i + 1]!.setting})`
          : undefined,
      wordTarget: card.estimatedWords ?? Math.max(400, Math.floor((ch1Outline.wordTarget ?? 3000) / scenes.length)),
    });
    logStage(`6. chapter-scenes-prose (scene ${i + 1}/${scenes.length})`, pr);
    const parsed = parseChapterSceneProseOutput(pr.content);
    segments.push({ sceneId: parsed.sceneId, prose: parsed.prose });
  }
  const chapter1Text = segments.map((s) => s.prose).join('\n\n');

  // ── 7. Continuity: Ch1 summary → Ch2 draft ──
  const sumRes = await post('chapter-summary', {
    genre: GENRE,
    chapterNumber: 1,
    chapterTitle: ch1Outline.title,
    chapterContent: chapter1Text,
  });
  logStage('7a. chapter-summary (Ch 1)', sumRes);
  let ch1Summary = '';
  try {
    ch1Summary = parseChapterSummary(sumRes.content);
  } catch (e) {
    warn(`Chapter summary ChapterSummaryOutputSchema validation failed (${e}); using raw trimmed content.`);
    ch1Summary = sumRes.content.trim();
  }
  canonGate('chapter-summary Ch1', ch1Summary.length > 120, !ch1Summary ? ['empty summary'] : ch1Summary.length < 120 ? ['summary very short vs rubric depth'] : []);

  const ch2Res = await post('chapters', {
    genre: GENRE,
    chapterNumber: 2,
    chapterTitle: ch2Outline.title,
    beatReference: ch2Outline.beatReference || '(see outline)',
    sceneGoal: ch2Outline.sceneGoal || '(see outline)',
    pov: ch2Outline.pov,
    assembledContext: canonBrief,
    charactersReference: charactersRef,
    endingReference: endingDocText,
    previousChapterSummaries: [
      { chapterNumber: 1, title: ch1Outline.title, summary: ch1Summary },
    ],
    structureContext: STUB_STRUCTURE_FIVE,
    genreResearch: '',
    nicheReference: STUB_NICHE,
    wordTarget: ch2Outline.wordTarget ?? 3200,
  });
  logStage('7b. chapters (Ch 2 opening)', ch2Res);

  // ── 8. Quality gate: per-scene eval chunks (matches app; avoids 800-token JSON cap on full chapter)
  const scenePlanJsonStr = JSON.stringify(scenePlan.scenePlan);
  let evaluation: ReturnType<typeof parseChapterEvaluation> = {
    checks: [],
    summary: '',
  };
  let evalSceneTokens = 0;
  for (const seg of segments) {
    const er = await post('chapter-scene-eval', {
      genre: GENRE,
      chapterNumber: 1,
      chapterTitle: ch1Outline.title,
      scenePlanJson: scenePlanJsonStr,
      chapterText: seg.prose,
      compactCanon: canonBrief,
      chunkLabel: seg.sceneId,
    });
    evalSceneTokens += er.tokensUsed;
    try {
      const part = parseChapterEvaluation(er.content);
      evaluation = {
        checks: [...evaluation.checks, ...part.checks],
        summary: [evaluation.summary, part.summary].filter(Boolean).join(' '),
      };
    } catch (e) {
      warn(`chapter-scene-eval parse failed for ${seg.sceneId} (budget/truncation?): ${e}`);
      throw e;
    }
  }
  logStage('8. chapter-scene-eval (Ch1, per-scene chunks)', {
    content: `(merged ${segments.length} scene-level eval calls)`,
    tokensUsed: evalSceneTokens,
    model: '(per-call model in server logs)',
  });
  const fails = evaluation.checks.filter((c) => c.severity === 'fail' && !c.pass);
  if (fails.length) console.log('Blocking eval rows:', JSON.stringify(fails, null, 2));
  canonGate('quality gate Ch1', fails.length === 0, [
    ...(fails.length ? [`fail rows: ${fails.map((f) => f.id).join(', ')}`] : []),
    ...(!evaluation.summary.trim() ? ['merged eval summary empty'] : []),
  ]);

  // ── 9. Editorial → structured revision queue ──
  const manuscript =
    `# Chapter 1: ${ch1Outline.title}\n\n${chapter1Text}\n\n# Chapter 2: ${ch2Outline.title}\n\n${ch2Res.content}`;
  const edRes = await post('editorial', {
    manuscript,
    genre: GENRE,
    assembledContext: canonBrief,
    nicheReference: STUB_NICHE,
    charactersReference: charactersRef,
    endingReference: endingDocText,
    structureReference: STUB_STRUCTURE_FIVE,
    editorialPass: 'structural',
    premise: PREMISE,
  });
  logStage('9a. editorial (structural report)', edRes);
  const editorialLooksStructural =
    /\b(issue|pacing|continuity|character|revision|chapter)\b/i.test(edRes.content) &&
    edRes.content.length > 400;
  if (!editorialLooksStructural)
    warn('Editorial Pass A may lack expected developmental markers — verify it is a structural report rather than stray short text.');
  canonGate('editorial report', editorialLooksStructural, [!editorialLooksStructural ? 'suspiciously thin report' : '']);

  const qRes = await post('editorial', {
    createQueue: true,
    editorialReport: edRes.content,
    chapterCount: 2,
    editorialPass: 'structural',
  });
  logStage('9b. editorial (revision queue JSON)', qRes);
  let queue: ReturnType<typeof parseRevisionQueue>;
  try {
    queue = parseRevisionQueue(qRes.content);
  } catch (e) {
    throw new Error(`Revision queue schema validation failed: ${e}`);
  }
  canonGate('revision queue JSON', queue.revisionTasks.length > 0, []);
  const ch1Issues = queue.revisionTasks.flatMap((t) =>
    t.chapterNumber === 1 ? t.issues.map((i) => ({ ...i, chapterNumber: 1 as const })) : []
  );
  if (ch1Issues.length === 0) {
    warn('No chapter 1 issues in revision queue; cannot demo scene-scoped fix from queue alone.');
  }

  const pick =
    ch1Issues.find((i) => i.sceneId && scenes.some((s) => s.id === i.sceneId)) ?? ch1Issues[0];

  // ── 10. Targeted revision + local re-eval ──
  let revisedSceneText = segments[0]!.prose;
  let targetSceneId = segments[0]!.sceneId;
  let revTokens = 0;

  if (pick?.sceneId) {
    const seg = segments.find((s) => s.sceneId === pick.sceneId);
    if (seg) {
      targetSceneId = pick.sceneId;
      const revisionRes = await post('revision', {
        originalContent: seg.prose,
        revisionInstructions: pick.fix,
        acceptanceCriteria: [pick.fix, pick.description].filter(Boolean) as string[],
        assembledContext: canonBrief,
        charactersReference: charactersRef,
        endingReference: endingDocText,
        structureReference: STUB_STRUCTURE_FIVE,
        nicheReference: STUB_NICHE,
        sceneRevisionSceneId: pick.sceneId,
        editorialPass: 'structural',
      });
      logStage(`10a. revision (scene-scoped ${pick.sceneId})`, revisionRes);
      revTokens = revisionRes.tokensUsed;
      revisedSceneText = revisionRes.content.trim();
    } else {
      warn(`Revision queue referenced sceneId "${pick.sceneId}" not found among drafted scenes — falling back to first scene + queue fix text.`);
      const revisionRes = await post('revision', {
        originalContent: segments[0]!.prose,
        revisionInstructions: pick.fix,
        acceptanceCriteria: [pick.fix, pick.description].filter(Boolean) as string[],
        assembledContext: canonBrief,
        charactersReference: charactersRef,
        endingReference: endingDocText,
        structureReference: STUB_STRUCTURE_FIVE,
        nicheReference: STUB_NICHE,
        sceneRevisionSceneId: segments[0]!.sceneId,
        editorialPass: 'structural',
      });
      logStage('10a. revision (fallback: queue sceneId mismatch)', revisionRes);
      revTokens = revisionRes.tokensUsed;
      revisedSceneText = revisionRes.content.trim();
      targetSceneId = segments[0]!.sceneId;
    }
  } else {
    warn('Applying fallback revision on first scene using first available fix text from queue.');
    const fallbackFix = queue.revisionTasks[0]?.issues[0]?.fix ?? 'Clarify physical grounding in Vienna; keep POV tightly on Elias.';
    const revisionRes = await post('revision', {
      originalContent: segments[0]!.prose,
      revisionInstructions: fallbackFix,
      assembledContext: canonBrief,
      charactersReference: charactersRef,
      endingReference: endingDocText,
      structureReference: STUB_STRUCTURE_FIVE,
      nicheReference: STUB_NICHE,
      sceneRevisionSceneId: segments[0]!.sceneId,
      editorialPass: 'structural',
    });
    logStage('10a. revision (fallback scene-1)', revisionRes);
    revTokens = revisionRes.tokensUsed;
    revisedSceneText = revisionRes.content.trim();
  }

  const revisedChapterFragment = revisedSceneText;
  const eval2 = await post('chapter-scene-eval', {
    genre: GENRE,
    chapterNumber: 1,
    chapterTitle: ch1Outline.title,
    scenePlanJson: JSON.stringify(scenePlan.scenePlan),
    chapterText: revisedChapterFragment,
    compactCanon: canonBrief,
    chunkLabel: targetSceneId,
  });
  logStage('10b. chapter-scene-eval (revised scene only)', eval2);
  try {
    const postRev = parseChapterEvaluation(eval2.content);
    const postFails = postRev.checks.filter((c) => c.severity === 'fail' && !c.pass);
    canonGate(`post-revision QA (${targetSceneId})`, postFails.length === 0, postFails.map((f) => `still failing ${f.id}`));
  } catch {
    warn('Could not parse post-revision chapter-scene-eval JSON.');
    canonGate(`post-revision QA (${targetSceneId})`, false, ['parse failure']);
  }

  console.log(
    `\nNote: A single full-chapter chapter-scene-eval call can exceed CHAPTER_SCENE_EVAL_OUTPUT_TOKEN_BUDGET (800) and return truncated JSON; this script uses per-scene eval for Ch1 (same idea as runMergedChapterSceneEvaluation).`
  );

  console.log('\n══════════════════════════════════════');
  console.log(`TOTAL TOKENS (sum of stage responses): ${cumulative}`);
  console.log(`Warnings (${warnings.length}):`);
  for (const w of warnings) console.log(` - ${w}`);
  console.log('══════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
