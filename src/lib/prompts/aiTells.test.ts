import { describe, expect, it } from 'vitest';
import {
  AI_TELLS_SYSTEM_BLOCK,
  AI_TELLS_EDITORIAL_CHECKLIST,
  formatGenreAiTellsAppend,
} from '@/lib/prompts/aiTells';
import { CHAPTER_SCENE_PROSE_SYSTEM } from '@/lib/prompts/scenes';
import { CHAPTERS_SYSTEM } from '@/lib/prompts/chapters';

describe('aiTells', () => {
  it('AI_TELLS_EDITORIAL_CHECKLIST is shorter editor-facing checklist', () => {
    expect(AI_TELLS_EDITORIAL_CHECKLIST).toContain('editor checklist');
    expect(AI_TELLS_EDITORIAL_CHECKLIST.length).toBeLessThan(AI_TELLS_SYSTEM_BLOCK.length);
  });

  it('AI_TELLS_SYSTEM_BLOCK includes core principle', () => {
    expect(AI_TELLS_SYSTEM_BLOCK).toContain('concrete observable detail');
    expect(AI_TELLS_SYSTEM_BLOCK).toContain('Never do');
    expect(AI_TELLS_SYSTEM_BLOCK).toContain('Use sparingly');
  });

  it('formatGenreAiTellsAppend returns historical block for Tudor romance', () => {
    const block = formatGenreAiTellsAppend('Historical Romance', 'Tudor court');
    expect(block).toContain('Genre-specific (historical');
    expect(block).toContain('trauma');
  });

  it('formatGenreAiTellsAppend returns fantasy block for progression fantasy', () => {
    const block = formatGenreAiTellsAppend('Progression Fantasy', 'dungeon');
    expect(block).toContain('Genre-specific (fantasy');
    expect(block).toContain('mentor lectures');
  });

  it('formatGenreAiTellsAppend returns empty for unrelated genre', () => {
    expect(formatGenreAiTellsAppend('Contemporary Thriller')).toBe('');
  });

  it('prose and chapter system prompts embed AI tells block', () => {
    expect(CHAPTER_SCENE_PROSE_SYSTEM).toContain('Avoiding AI tells');
    expect(CHAPTERS_SYSTEM).toContain('Avoiding AI tells');
  });
});
