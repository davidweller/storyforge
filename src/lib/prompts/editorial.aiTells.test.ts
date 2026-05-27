import { describe, expect, it } from 'vitest';
import {
  AI_TELLS_EDITORIAL_CHECKLIST,
  AI_TELLS_STRUCTURAL_MACRO,
} from '@/lib/prompts/aiTells';
import {
  buildEditorialPrompt,
  buildEditorialIssuesQueuePrompt,
} from '@/lib/prompts/editorial';

const MANUSCRIPT = 'Chapter 1\n\nTest.';

const baseEditorialParams = {
  manuscript: MANUSCRIPT,
  genre: 'Fantasy',
  charactersReference: '',
  endingReference: '',
};

describe('editorial AI tells', () => {
  it('line pass includes editorial checklist and AI tells subsection', () => {
    const prompt = buildEditorialPrompt({
      ...baseEditorialParams,
      editorialPass: 'line',
    });
    expect(prompt).toContain(AI_TELLS_EDITORIAL_CHECKLIST);
    expect(prompt).toContain('AI tells and stock phrasing');
    expect(prompt).toContain('filtering verbs');
  });

  it('line pass includes genre append for historical romance', () => {
    const prompt = buildEditorialPrompt({
      ...baseEditorialParams,
      genre: 'Historical Romance',
      nicheReference: 'Tudor court',
      editorialPass: 'line',
    });
    expect(prompt).toContain('Genre-specific (historical');
    expect(prompt).toContain('trauma');
  });

  it('structural pass includes macro patterns only, not sentence-level filtering probe', () => {
    const prompt = buildEditorialPrompt({
      ...baseEditorialParams,
      editorialPass: 'structural',
    });
    expect(prompt).toContain(AI_TELLS_STRUCTURAL_MACRO);
    expect(prompt).toContain('mentor');
    expect(prompt).not.toContain(AI_TELLS_EDITORIAL_CHECKLIST);
    expect(prompt).not.toContain('filtering verbs');
  });

  it('proofread pass excludes editorial checklist', () => {
    const prompt = buildEditorialPrompt({
      ...baseEditorialParams,
      editorialPass: 'proofread',
    });
    expect(prompt).not.toContain(AI_TELLS_EDITORIAL_CHECKLIST);
    expect(prompt).not.toContain(AI_TELLS_STRUCTURAL_MACRO);
    expect(prompt).not.toContain('AI tells and stock phrasing');
  });

  it('editorial-issues line pass includes prose-category AI-tell rules', () => {
    const prompt = buildEditorialIssuesQueuePrompt({
      ...baseEditorialParams,
      chapterCount: 1,
      editorialPass: 'line',
    });
    expect(prompt).toContain(AI_TELLS_EDITORIAL_CHECKLIST);
    expect(prompt).toContain('category: "prose"');
    expect(prompt).toContain('manuscriptQuote');
  });

  it('editorial-issues proofread pass excludes AI-tell checklist', () => {
    const prompt = buildEditorialIssuesQueuePrompt({
      ...baseEditorialParams,
      chapterCount: 1,
      editorialPass: 'proofread',
    });
    expect(prompt).not.toContain(AI_TELLS_EDITORIAL_CHECKLIST);
    expect(prompt).not.toContain('Flag AI tells and stock phrasing');
  });
});
