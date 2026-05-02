/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearFullAutoRunMarkers,
  fullAutoCheckpointPendingKey,
  labelForFullAutoLastStep,
  readFullAutoCheckpointPending,
  readFullAutoLastStep,
  writeFullAutoCheckpointPending,
  writeFullAutoLastStep,
  fullAutoLastStepKey,
} from './checkpointStorage';

const pid = 'test-proj-checkpoint';

beforeEach(() => {
  clearFullAutoRunMarkers(pid);
  localStorage.clear();
});

describe('checkpointStorage', () => {
  it('round-trips last step and pending checkpoint payloads', () => {
    expect(readFullAutoLastStep(pid)).toBeNull();
    expect(readFullAutoCheckpointPending(pid)).toBeNull();

    writeFullAutoLastStep(pid, 'after-title');
    expect(localStorage.getItem(fullAutoLastStepKey(pid))).toBe('after-title');
    expect(readFullAutoLastStep(pid)).toBe('after-title');

    writeFullAutoCheckpointPending(pid, {
      stepKey: 'after-title',
      title: 'Review title',
      bullets: ['Pick one', 'Save'],
    });

    const pending = readFullAutoCheckpointPending(pid);
    expect(pending).toMatchObject({
      v: 1,
      stepKey: 'after-title',
      title: 'Review title',
      bullets: ['Pick one', 'Save'],
    });

    expect(JSON.parse(localStorage.getItem(fullAutoCheckpointPendingKey(pid))!)).toMatchObject({
      v: 1,
      stepKey: 'after-title',
    });
  });

  it('labelForFullAutoLastStep covers known keys and chapter scene-plan pattern', () => {
    expect(labelForFullAutoLastStep('after-ending')).toBe('Ending checkpoint');
    expect(labelForFullAutoLastStep('after-chapter-3-scene-plan')).toBe('Chapter 3 scene plan');
  });

  it('clears run markers', () => {
    writeFullAutoLastStep(pid, 'after-outlines');
    writeFullAutoCheckpointPending(pid, {
      stepKey: 'after-outlines',
      title: 'x',
      bullets: [],
    });
    clearFullAutoRunMarkers(pid);
    expect(readFullAutoLastStep(pid)).toBeNull();
    expect(readFullAutoCheckpointPending(pid)).toBeNull();
  });
});
