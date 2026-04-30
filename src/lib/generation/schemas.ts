import { z } from 'zod';

export const EndingConceptSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  summary: z.string().min(1),
  emotionalPayoff: z.string().default(''),
  characterResolution: z.string().default(''),
  thematicStatement: z.string().default(''),
});

export const EndingConceptsOutputSchema = z.object({
  endings: z.array(EndingConceptSchema).min(1),
});

export const ExpandedEndingBlueprintSchema = z.object({
  finalSceneVision: z.string().min(1),
  climaxRequirements: z.string().min(1),
  emotionalArcCompletion: z.string().min(1),
  keyReversalsNeeded: z.string().min(1),
  thematicResonance: z.string().min(1),
  sequelSeriesPotential: z.string().optional().default(''),
});

export const TitleIdeasOutputSchema = z.object({
  titles: z.array(z.string().min(1)).min(1),
});

export const ChapterOutlineSchema = z.object({
  chapterNumber: z.number().int().positive(),
  title: z.string().min(1),
  beatReference: z.string().default(''),
  sceneGoal: z.string().default(''),
  pov: z.string().optional(),
  wordTarget: z.number().int().positive().optional(),
  keyPlotPoints: z.array(z.string()).optional().default([]),
});

export const ChapterOutlinesOutputSchema = z.object({
  chapters: z.array(ChapterOutlineSchema).min(1),
  overview: z.string().optional().default(''),
});

export const ChapterSummaryOutputSchema = z.object({
  summary: z.string().min(1),
});

export const StoryBibleSourceRefSchema = z.object({
  documentType: z.string().min(1),
  documentId: z.string().min(1),
  version: z.number().int().positive(),
  updatedAt: z.string().min(1),
});

export const StoryBibleDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  storyBibleVersion: z.number().int().positive(),
  generatedAt: z.string().min(1),
  approvedAt: z.string().nullable(),
  derivedFrom: z.array(StoryBibleSourceRefSchema).min(1),
  logline: z.string().min(1),
  genrePromise: z.string().min(1),
  audiencePromise: z.string().min(1),
  voiceAndStyle: z.object({
    pov: z.string().min(1),
    tense: z.string().min(1),
    narrativeDistance: z.string().min(1),
    styleRules: z.array(z.string().min(1)).default([]),
    avoid: z.array(z.string().min(1)).default([]),
  }),
  themes: z.array(z.string().min(1)).default([]),
  characters: z.array(z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    want: z.string().min(1),
    need: z.string().min(1),
    flaw: z.string().min(1),
    arcPromise: z.string().min(1),
    voiceNotes: z.array(z.string().min(1)).default([]),
    hardConstraints: z.array(z.string().min(1)).default([]),
  })).default([]),
  relationships: z.array(z.object({
    participants: z.array(z.string().min(1)).min(1),
    startingState: z.string().min(1),
    targetState: z.string().min(1),
    tension: z.string().min(1),
    constraints: z.array(z.string().min(1)).default([]),
  })).default([]),
  worldRules: z.array(z.string().min(1)).default([]),
  timelineFacts: z.array(z.string().min(1)).default([]),
  unresolvedThreads: z.array(z.object({
    thread: z.string().min(1),
    introducedBy: z.string().min(1),
    mustResolveBy: z.string().min(1),
    status: z.string().min(1),
  })).default([]),
  endingPromises: z.array(z.string().min(1)).default([]),
  forbiddenChanges: z.array(z.string().min(1)).default([]),
});

export const StoryBibleOutputSchema = z.object({
  storyBible: StoryBibleDocumentSchema,
});

export const CreativeBriefDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  creativeBriefVersion: z.number().int().positive(),
  generatedAt: z.string().min(1),
  derivedFromStoryBible: z.object({
    documentId: z.string().min(1),
    version: z.number().int().positive(),
    updatedAt: z.string().min(1),
  }),
  brief: z.string().min(1),
});

export const CreativeBriefOutputSchema = z.object({
  creativeBrief: CreativeBriefDocumentSchema,
});

export const RevisionQueueIssueSchema = z.object({
  category: z.enum(['continuity', 'character', 'pacing', 'prose', 'logic']),
  description: z.string().min(1),
  manuscriptQuote: z.string().optional().default(''),
  location: z.string().default(''),
  fix: z.string().min(1),
  sceneId: z.string().optional(),
});

export const RevisionQueueTaskSchema = z.object({
  chapterNumber: z.number().int().positive(),
  issueCount: z.number().int().min(0),
  priority: z.enum(['high', 'medium', 'low', 'none']).default('none'),
  summary: z.string().default(''),
  issues: z.array(RevisionQueueIssueSchema).default([]),
  acceptanceCriteria: z.array(z.string()).default([]),
  preserveElements: z.array(z.string()).default([]),
});

export const RevisionQueueOutputSchema = z.object({
  revisionTasks: z.array(RevisionQueueTaskSchema),
});

export const RevisionVerificationSchema = z.object({
  satisfied: z.boolean(),
  checklist: z.array(
    z.object({
      criterion: z.string(),
      met: z.boolean(),
      evidence: z.string(),
    })
  ),
  overallNotes: z.string().optional(),
});

export type EndingConcept = z.infer<typeof EndingConceptSchema> & { id: string };
export type ChapterOutline = z.infer<typeof ChapterOutlineSchema>;
export type RevisionQueue = z.infer<typeof RevisionQueueOutputSchema>;
export type RevisionVerification = z.infer<typeof RevisionVerificationSchema>;
export type StoryBibleOutput = z.infer<typeof StoryBibleOutputSchema>;
export type CreativeBriefOutput = z.infer<typeof CreativeBriefOutputSchema>;

function extractJsonCandidate(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  return JSON.parse(candidate);
}

export function parseTitleOptions(content: string): string[] {
  if (!content?.trim()) return [];
  try {
    const parsed = TitleIdeasOutputSchema.parse(extractJsonCandidate(content));
    return parsed.titles.map((title) => title.trim()).filter(Boolean).slice(0, 15);
  } catch {
    return content
      .split(/\n/)
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').replace(/^[-*]\s*/, '').trim())
      .filter((line) => line.length > 0)
      .slice(0, 15);
  }
}

export function parseEndingConcepts(content: string): EndingConcept[] {
  if (!content?.trim()) return [];
  try {
    const parsed = EndingConceptsOutputSchema.parse(extractJsonCandidate(content));
    return parsed.endings.map((concept, index) => ({
      ...concept,
      id: concept.id || `ending-${index + 1}`,
    }));
  } catch {
    const concepts: EndingConcept[] = [];
    const sections = content.split(/(?=\d+\.\s)/).filter((s) => s.trim());
    if (sections.length <= 1) return concepts;

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed || !/^\d+\.\s/.test(trimmed)) continue;
      const titleMatch = trimmed.match(/\*\*([^*]+)\*\*/);
      const firstLine = trimmed.split(/\n/)[0]?.replace(/^\d+\.\s*/, '').trim() || '';
      const title = titleMatch ? titleMatch[1].trim() : (firstLine || trimmed.slice(0, 80));
      if (!title) continue;
      const summaryMatch = trimmed.match(/Summary[:\s]*([^\n]+(?:\n(?!\d+\.\s|\*\*)[^\n]+)*)/i);
      const emotionalMatch = trimmed.match(/Emotional[^:]*[:\s]*([^\n]+)/i);
      const characterMatch = trimmed.match(/Character[^:]*[:\s]*([^\n]+)/i);
      const thematicMatch = trimmed.match(/Thematic[^:]*[:\s]*([^\n]+)/i);
      concepts.push({
        id: `ending-${concepts.length + 1}`,
        title,
        summary: summaryMatch?.[1]?.trim() || trimmed.slice(title.length, 200 + title.length).trim() || trimmed.slice(0, 200),
        emotionalPayoff: emotionalMatch?.[1]?.trim() || '',
        characterResolution: characterMatch?.[1]?.trim() || '',
        thematicStatement: thematicMatch?.[1]?.trim() || '',
      });
    }
    return concepts;
  }
}

export function parseChapterOutlines(content: string): ChapterOutline[] {
  if (!content?.trim()) return [];
  try {
    return ChapterOutlinesOutputSchema.parse(extractJsonCandidate(content)).chapters;
  } catch {
    const outlines: ChapterOutline[] = [];
    const strictRegex = /\*\*Chapter\s+(\d+):\s*(.+?)\*\*/g;
    const lenientRegex = /^#{0,3}\s*\*{0,2}Chapter\s+(\d+):\s*(.+?)(?:\*{2})?\s*$/gm;
    const matches: Array<{ index: number; number: number; title: string; endIndex: number }> = [];
    let match;
    while ((match = strictRegex.exec(content)) !== null) {
      matches.push({
        index: match.index,
        number: parseInt(match[1], 10),
        title: (match[2]?.trim() || '').replace(/\*+$/, ''),
        endIndex: match.index + match[0].length,
      });
    }
    if (matches.length === 0) {
      while ((match = lenientRegex.exec(content)) !== null) {
        matches.push({
          index: match.index,
          number: parseInt(match[1], 10),
          title: (match[2]?.trim() || '').replace(/\*+$/, ''),
          endIndex: match.index + match[0].length,
        });
      }
    }
    matches.sort((a, b) => a.index - b.index);
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const startIndex = current.endIndex;
      const endIndex = next ? next.index : content.length;
      const chapterContent = content.substring(startIndex, endIndex);
      if (isNaN(current.number)) continue;
      const beatMatch = chapterContent.match(/(?:^[-*]\s*)?\*{0,2}(?:Story\s+)?Beat\(s\)\*{0,2}\s*:\s*(.+?)(?:\n|$)/im);
      const sceneGoalMatch = chapterContent.match(/(?:^[-*]\s*)?\*{0,2}Scene Goal\*{0,2}\s*:\s*(.+?)(?:\n|$)/im);
      const povMatch = chapterContent.match(/(?:^[-*]\s*)?\*{0,2}(?:POV|POV Character)\*{0,2}\s*:\s*(.+?)(?:\n|$)/im);
      const wordTargetMatch = chapterContent.match(/(?:^[-*]\s*)?\*{0,2}Word Target\*{0,2}\s*:\s*~?(\d+)/im);
      outlines.push({
        chapterNumber: current.number,
        title: current.title,
        beatReference: beatMatch?.[1]?.trim() || '',
        sceneGoal: sceneGoalMatch?.[1]?.trim() || '',
        pov: povMatch?.[1]?.trim() || undefined,
        wordTarget: wordTargetMatch ? parseInt(wordTargetMatch[1], 10) : undefined,
        keyPlotPoints: [],
      });
    }
    return outlines;
  }
}

export function parseRevisionQueue(content: string): RevisionQueue {
  return RevisionQueueOutputSchema.parse(extractJsonCandidate(content));
}

export function parseRevisionVerification(content: string): RevisionVerification {
  return RevisionVerificationSchema.parse(extractJsonCandidate(content));
}

export function parseChapterSummary(content: string): string {
  if (!content?.trim()) return '';
  try {
    return ChapterSummaryOutputSchema.parse(extractJsonCandidate(content)).summary.trim();
  } catch {
    return content.trim();
  }
}

export function parseStoryBible(content: string): StoryBibleOutput {
  return StoryBibleOutputSchema.parse(extractJsonCandidate(content));
}

export function parseCreativeBrief(content: string): CreativeBriefOutput {
  return CreativeBriefOutputSchema.parse(extractJsonCandidate(content));
}

// ── Phase 4: scene plans, scene prose, chapter evaluation ─────────────────────

export const OutlineSourceRefSchema = z.object({
  documentId: z.string().min(1),
  version: z.number().int().positive(),
  updatedAt: z.string().min(1),
});

export const SceneCardSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().nonnegative(),
  purpose: z.string().min(1),
  conflict: z.string().default(''),
  turningPoint: z.string().default(''),
  pov: z.string().default(''),
  setting: z.string().default(''),
  emotionalShift: z.string().default(''),
  beatsCovered: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => {
      if (v == null) return [] as string[];
      return typeof v === 'string' ? (v.trim() ? [v] : []) : v;
    }),
  mustInclude: z.array(z.string()).optional().default([]),
  estimatedWords: z.number().int().positive().optional(),
});

export const ChapterScenePlanDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  chapterNumber: z.number().int().positive(),
  generatedAt: z.string().min(1),
  derivedFromChapterOutlines: OutlineSourceRefSchema,
  scenes: z.array(SceneCardSchema).min(1),
});

export const ChapterScenePlanOutputSchema = z.object({
  scenePlan: ChapterScenePlanDocumentSchema,
});

export const ChapterSceneProseOutputSchema = z.object({
  sceneId: z.string().min(1),
  prose: z.string().min(1),
});

export const ChapterEvaluationCheckSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1),
  pass: z.boolean(),
  severity: z.enum(['info', 'warn', 'fail']),
  evidence: z.string().default(''),
  suggestion: z.string().default(''),
});

export const ChapterEvaluationSchema = z.object({
  checks: z.array(ChapterEvaluationCheckSchema),
  summary: z.string().optional().default(''),
});

export type SceneCard = z.infer<typeof SceneCardSchema>;
export type ChapterScenePlanDocument = z.infer<typeof ChapterScenePlanDocumentSchema>;
export type ChapterScenePlanOutput = z.infer<typeof ChapterScenePlanOutputSchema>;
export type ChapterSceneProseOutput = z.infer<typeof ChapterSceneProseOutputSchema>;
export type ChapterEvaluation = z.infer<typeof ChapterEvaluationSchema>;

export function parseChapterScenePlan(content: string): ChapterScenePlanOutput {
  return ChapterScenePlanOutputSchema.parse(extractJsonCandidate(content));
}

export function parseChapterSceneProseOutput(content: string): ChapterSceneProseOutput {
  return ChapterSceneProseOutputSchema.parse(extractJsonCandidate(content));
}

export function parseChapterEvaluation(content: string): ChapterEvaluation {
  return ChapterEvaluationSchema.parse(extractJsonCandidate(content));
}

export function formatSchemaError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('\n');
}
