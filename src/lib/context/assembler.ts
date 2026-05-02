import type {
  AssembledContext,
  Chapter,
  ChapterVersion,
  ContextBudget,
  ContextPurpose,
  ContextSection,
  DocumentType,
  Project,
  ProjectDocument,
  StoryBibleDocument,
  StoryBibleSourceRef,
} from '@/types';
import { parseCreativeBrief, parseChapterOutlines, parseStoryBible } from '@/lib/generation/schemas';
import { estimateTokens } from '@/lib/utils';
import { contextBlock } from '@/lib/prompts/utils';

const SOURCE_DOCUMENT_TYPES: DocumentType[] = [
  'genre',
  'niche',
  'ending',
  'ending-choice',
  'characters',
  'structure',
  'chapter-outlines',
];

const DEFAULT_BUDGETS: Record<ContextPurpose, ContextBudget> = {
  'chapter-draft': { totalTokens: 8_000, maxSectionTokens: 2_000 },
  'scene-plan': { totalTokens: 7_000, maxSectionTokens: 1_800 },
  'chapter-eval': { totalTokens: 5_000, maxSectionTokens: 1_200 },
  'chapter-summary': { totalTokens: 3_000, maxSectionTokens: 1_200 },
  'chapter-revision': { totalTokens: 7_000, maxSectionTokens: 1_800 },
  editorial: { totalTokens: 5_000, maxSectionTokens: 1_500 },
  'chapter-outline': { totalTokens: 7_000, maxSectionTokens: 1_800 },
  title: { totalTokens: 3_000, maxSectionTokens: 1_000 },
  marketing: { totalTokens: 3_500, maxSectionTokens: 1_200 },
  'full-auto': { totalTokens: 8_000, maxSectionTokens: 2_000 },
};

export interface AssembleContextInput {
  purpose: ContextPurpose;
  project: Project;
  documents: ProjectDocument[];
  chapters?: Chapter[];
  approvedChapterVersions?: ChapterVersion[];
  currentChapter?: Chapter;
  targetChapterNumber?: number;
  revisionInstructions?: string;
  editorialPass?: string;
  budget?: Partial<ContextBudget>;
  canonFacts?: unknown[];
  requireCanonFacts?: boolean;
}

function latestApprovedDocument(documents: ProjectDocument[], type: DocumentType): ProjectDocument | undefined {
  return documents
    .filter((document) => document.type === type && document.approved)
    .sort((a, b) => b.version - a.version || b.updatedAt.getTime() - a.updatedAt.getTime())[0];
}

export function buildStoryBibleSourceRefs(documents: ProjectDocument[]): StoryBibleSourceRef[] {
  return SOURCE_DOCUMENT_TYPES
    .map((type) => latestApprovedDocument(documents, type))
    .filter((document): document is ProjectDocument => !!document)
    .map((document) => ({
      documentType: document.type,
      documentId: document.id,
      version: document.version,
      updatedAt: document.updatedAt.toISOString(),
    }));
}

/** Story Bible is generated only after outlines exist—approved and parseable into ≥1 chapter. */
export type ValidatedChapterOutlinesGate =
  | { ok: true; document: ProjectDocument; chapterCount: number }
  | { ok: false; reason: string };

export function getValidatedApprovedChapterOutlines(
  documents: ProjectDocument[],
): ValidatedChapterOutlinesGate {
  const doc = documents
    .filter((d) => d.type === 'chapter-outlines' && d.approved)
    .sort((a, b) => b.version - a.version || b.updatedAt.getTime() - a.updatedAt.getTime())[0];

  if (!doc) {
    return {
      ok: false,
      reason: 'Approve the Chapter Outlines document before generating a Story Bible.',
    };
  }
  if (!doc.content?.trim()) {
    return {
      ok: false,
      reason: 'Chapter Outlines are empty. Generate and approve outlines first.',
    };
  }

  const chapters = parseChapterOutlines(doc.content);
  if (chapters.length < 1) {
    return {
      ok: false,
      reason:
        'Chapter Outlines must include at least one chapter the app can parse. Fix the outline format on the Chapter Outlines stage and approve again.',
    };
  }

  return { ok: true, document: doc, chapterCount: chapters.length };
}

function parseStoryBibleDocument(document: ProjectDocument | undefined): StoryBibleDocument | null {
  if (!document?.content.trim()) return null;
  try {
    return parseStoryBible(document.content).storyBible as StoryBibleDocument;
  } catch {
    return null;
  }
}

export function isStoryBibleStale(
  storyBibleDocument: ProjectDocument | undefined,
  currentDocuments: ProjectDocument[]
): boolean {
  const storyBible = parseStoryBibleDocument(storyBibleDocument);
  if (!storyBible) return true;

  const currentRefs = buildStoryBibleSourceRefs(currentDocuments);
  if (currentRefs.length !== storyBible.derivedFrom.length) return true;

  return currentRefs.some((currentRef) => {
    const savedRef = storyBible.derivedFrom.find((ref) => ref.documentType === currentRef.documentType);
    return !savedRef
      || savedRef.documentId !== currentRef.documentId
      || savedRef.version !== currentRef.version
      || savedRef.updatedAt !== currentRef.updatedAt;
  });
}

export function isCreativeBriefStale(
  creativeBriefDocument: ProjectDocument | undefined,
  storyBibleDocument: ProjectDocument | undefined
): boolean {
  if (!creativeBriefDocument || !storyBibleDocument) return true;
  try {
    const source = parseCreativeBrief(creativeBriefDocument.content).creativeBrief.derivedFromStoryBible;
    return source.documentId !== storyBibleDocument.id
      || source.version !== storyBibleDocument.version
      || source.updatedAt !== storyBibleDocument.updatedAt.toISOString();
  } catch {
    return true;
  }
}

function truncateToTokens(text: string, maxTokens: number): { text: string; truncated: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { text: '', truncated: false };
  if (estimateTokens(trimmed) <= maxTokens) return { text: trimmed, truncated: false };

  const truncated = trimmed.slice(0, Math.max(0, maxTokens * 4)).trimEnd();
  return {
    text: `${truncated}\n[...section truncated to fit context budget...]`,
    truncated: true,
  };
}

function listItems(items: string[] | undefined): string {
  return (items ?? []).filter(Boolean).map((item) => `- ${item}`).join('\n');
}

function storyBibleSections(storyBible: StoryBibleDocument | null, currentChapter?: Chapter): {
  styleSheet: string;
  characterCards: string;
  relationshipState: string;
  worldRules: string;
  unresolvedThreads: string;
  futureConstraints: string;
} {
  if (!storyBible) {
    return {
      styleSheet: '',
      characterCards: '',
      relationshipState: '',
      worldRules: '',
      unresolvedThreads: '',
      futureConstraints: '',
    };
  }

  const pov = currentChapter?.pov?.toLowerCase();
  const relevantCharacters = storyBible.characters
    .filter((character, index) => {
      if (index < 4) return true;
      return pov ? character.name.toLowerCase().includes(pov) || pov.includes(character.name.toLowerCase()) : false;
    })
    .slice(0, 8);

  return {
    styleSheet: [
      `POV: ${storyBible.voiceAndStyle.pov}`,
      `Tense: ${storyBible.voiceAndStyle.tense}`,
      `Narrative distance: ${storyBible.voiceAndStyle.narrativeDistance}`,
      storyBible.voiceAndStyle.styleRules.length ? `Style rules:\n${listItems(storyBible.voiceAndStyle.styleRules)}` : '',
      storyBible.voiceAndStyle.avoid.length ? `Avoid:\n${listItems(storyBible.voiceAndStyle.avoid)}` : '',
    ].filter(Boolean).join('\n'),
    characterCards: relevantCharacters.map((character) => [
      `${character.name} (${character.role})`,
      `Want: ${character.want}`,
      `Need: ${character.need}`,
      `Flaw: ${character.flaw}`,
      `Arc promise: ${character.arcPromise}`,
      character.voiceNotes.length ? `Voice: ${character.voiceNotes.join('; ')}` : '',
      character.hardConstraints.length ? `Hard constraints: ${character.hardConstraints.join('; ')}` : '',
    ].filter(Boolean).join('\n')).join('\n\n'),
    relationshipState: storyBible.relationships.map((relationship) => [
      `${relationship.participants.join(' / ')}`,
      `Starts: ${relationship.startingState}`,
      `Target: ${relationship.targetState}`,
      `Tension: ${relationship.tension}`,
      relationship.constraints.length ? `Constraints: ${relationship.constraints.join('; ')}` : '',
    ].filter(Boolean).join('\n')).join('\n\n'),
    worldRules: [
      storyBible.worldRules.length ? `World rules:\n${listItems(storyBible.worldRules)}` : '',
      storyBible.timelineFacts.length ? `Timeline facts:\n${listItems(storyBible.timelineFacts)}` : '',
    ].filter(Boolean).join('\n\n'),
    unresolvedThreads: storyBible.unresolvedThreads.map((thread) =>
      `- ${thread.thread} (introduced by ${thread.introducedBy}; resolve by ${thread.mustResolveBy}; status: ${thread.status})`
    ).join('\n'),
    futureConstraints: [
      storyBible.endingPromises.length ? `Ending promises:\n${listItems(storyBible.endingPromises)}` : '',
      storyBible.forbiddenChanges.length ? `Forbidden changes:\n${listItems(storyBible.forbiddenChanges)}` : '',
    ].filter(Boolean).join('\n\n'),
  };
}

function chapterGoalText(input: AssembleContextInput): string {
  const chapter = input.currentChapter;
  if (!chapter && !input.targetChapterNumber) return '';

  const outlinesDoc = latestApprovedDocument(input.documents, 'chapter-outlines');
  const outline = outlinesDoc
    ? parseChapterOutlines(outlinesDoc.content).find((entry) =>
      entry.chapterNumber === (chapter?.chapterNumber ?? input.targetChapterNumber)
    )
    : undefined;

  return [
    `Target chapter: ${chapter?.chapterNumber ?? input.targetChapterNumber}${outline?.title || chapter?.title ? ` - "${outline?.title || chapter?.title}"` : ''}`,
    outline?.beatReference || chapter?.beatReference ? `Beat: ${outline?.beatReference || chapter?.beatReference}` : '',
    outline?.sceneGoal || chapter?.sceneGoal ? `Scene goal: ${outline?.sceneGoal || chapter?.sceneGoal}` : '',
    outline?.pov || chapter?.pov ? `POV: ${outline?.pov || chapter?.pov}` : '',
    outline?.wordTarget ? `Word target: ${outline.wordTarget}` : '',
    outline?.keyPlotPoints?.length ? `Key plot points:\n${listItems(outline.keyPlotPoints)}` : '',
    input.revisionInstructions ? `Revision instructions:\n${input.revisionInstructions}` : '',
    input.editorialPass ? `Editorial pass: ${input.editorialPass}` : '',
  ].filter(Boolean).join('\n');
}

function recentContinuityText(input: AssembleContextInput): string {
  const target = input.currentChapter?.chapterNumber ?? input.targetChapterNumber;
  if (!target) return '';

  const chapterTitles = new Map((input.chapters ?? []).map((chapter) => [chapter.chapterNumber, chapter.title]));
  return (input.approvedChapterVersions ?? [])
    .filter((version) => version.chapterNumber < target && !!version.notes?.trim())
    .sort((a, b) => b.chapterNumber - a.chapterNumber)
    .slice(0, 3)
    .map((version) => `- Chapter ${version.chapterNumber}: "${chapterTitles.get(version.chapterNumber) ?? 'Untitled'}"\n${version.notes}`)
    .join('\n\n');
}

function addSection(
  sections: ContextSection[],
  warnings: string[],
  budget: ContextBudget,
  id: string,
  title: string,
  rawText: string
): void {
  const content = rawText.trim();
  if (!content) return;

  const sectionBudget = Math.min(budget.sections?.[id] ?? budget.maxSectionTokens, budget.maxSectionTokens);
  const remaining = budget.totalTokens - sections.reduce((sum, section) => sum + section.tokenEstimate, 0);
  if (remaining <= 0) {
    warnings.push(`Context budget exhausted before ${title}.`);
    sections.push({ id, title, text: '', tokenEstimate: 0, truncated: false, omitted: true });
    return;
  }

  const { text, truncated } = truncateToTokens(content, Math.min(sectionBudget, remaining));
  if (truncated) warnings.push(`${title} was truncated to fit the context budget.`);
  sections.push({ id, title, text, tokenEstimate: estimateTokens(text), truncated });
}

export function assembleContext(input: AssembleContextInput): AssembledContext {
  const baseBudget = DEFAULT_BUDGETS[input.purpose];
  const budget: ContextBudget = {
    ...baseBudget,
    ...input.budget,
    sections: { ...baseBudget.sections, ...input.budget?.sections },
  };
  const warnings: string[] = [];
  const sections: ContextSection[] = [];

  const storyBibleDoc = latestApprovedDocument(input.documents, 'story-bible');
  const creativeBriefDoc = latestApprovedDocument(input.documents, 'creative-brief');
  const storyBible = parseStoryBibleDocument(storyBibleDoc);
  const storyBibleStale = storyBibleDoc ? isStoryBibleStale(storyBibleDoc, input.documents) : true;
  const creativeBriefStale = creativeBriefDoc ? isCreativeBriefStale(creativeBriefDoc, storyBibleDoc) : true;

  if (!storyBibleDoc) warnings.push('No approved Story Bible is available; using approved planning documents as fallback.');
  if (storyBibleDoc && !storyBible) warnings.push('Approved Story Bible could not be parsed; using approved planning documents as fallback.');
  if (storyBibleDoc && storyBibleStale) warnings.push('Approved Story Bible may be stale against current approved planning documents.');
  if (!creativeBriefDoc) warnings.push('No approved Creative Brief is available; using Story Bible sections as fallback.');
  if (creativeBriefDoc && creativeBriefStale) warnings.push('Approved Creative Brief is stale against the current Story Bible.');
  if (input.requireCanonFacts && !input.canonFacts) warnings.push('Canon facts were requested but are unavailable; using document-backed context.');

  const projectBrief = [
    input.project.title ? `Title: ${input.project.title}` : '',
    `Genre: ${input.project.genre}`,
    input.project.niche ? `Niche: ${input.project.niche}` : '',
    input.project.microniche ? `Microniche: ${input.project.microniche}` : '',
    input.project.premise ? `Premise: ${input.project.premise}` : '',
    input.project.research ? `Research notes: ${input.project.research}` : '',
    storyBible?.logline ? `Logline: ${storyBible.logline}` : '',
    storyBible?.genrePromise ? `Genre promise: ${storyBible.genrePromise}` : '',
    storyBible?.audiencePromise ? `Audience promise: ${storyBible.audiencePromise}` : '',
  ].filter(Boolean).join('\n');

  const creativeBrief = creativeBriefDoc && !creativeBriefStale
    ? parseCreativeBrief(creativeBriefDoc.content).creativeBrief.brief
    : '';
  const bibleSections = storyBibleSections(storyBible, input.currentChapter);

  addSection(sections, warnings, budget, 'project_brief', 'Project Brief', projectBrief);
  addSection(sections, warnings, budget, 'creative_brief', 'Creative Brief', creativeBrief);
  addSection(sections, warnings, budget, 'style_sheet', 'Style Sheet', bibleSections.styleSheet);
  addSection(sections, warnings, budget, 'character_cards', 'Character Cards', bibleSections.characterCards);
  addSection(sections, warnings, budget, 'relationship_state', 'Relationship State', bibleSections.relationshipState);
  addSection(sections, warnings, budget, 'world_rules', 'World Rules', bibleSections.worldRules);
  addSection(sections, warnings, budget, 'chapter_goal', 'Chapter Goal', chapterGoalText(input));
  addSection(sections, warnings, budget, 'recent_continuity', 'Recent Continuity', recentContinuityText(input));
  addSection(sections, warnings, budget, 'unresolved_threads', 'Unresolved Threads', bibleSections.unresolvedThreads);
  addSection(sections, warnings, budget, 'future_constraints', 'Future Constraints', bibleSections.futureConstraints);

  if (!storyBible) {
    const charCap = budget.sections?.legacy_characters ?? budget.maxSectionTokens;
    const structCap = budget.sections?.legacy_structure ?? budget.maxSectionTokens;
    const endCap = budget.sections?.legacy_ending ?? budget.maxSectionTokens;
    addSection(
      sections,
      warnings,
      budget,
      'legacy_characters',
      'Legacy Characters',
      contextBlock('characters_reference', latestApprovedDocument(input.documents, 'characters')?.content, charCap),
    );
    addSection(
      sections,
      warnings,
      budget,
      'legacy_structure',
      'Legacy Structure',
      contextBlock('structure_reference', latestApprovedDocument(input.documents, 'structure')?.content, structCap),
    );
    addSection(
      sections,
      warnings,
      budget,
      'legacy_ending',
      'Legacy Ending',
      contextBlock('ending_reference', latestApprovedDocument(input.documents, 'ending')?.content, endCap),
    );
  }

  const renderedSections = sections
    .filter((section) => !section.omitted && section.text.trim())
    .map((section) => `<${section.id}>\n${section.text}\n</${section.id}>`)
    .join('\n\n');

  const text = `<canon_context purpose="${input.purpose}">\n${renderedSections}\n</canon_context>`;

  return {
    purpose: input.purpose,
    text,
    sections,
    warnings,
    tokenEstimate: estimateTokens(text),
  };
}
