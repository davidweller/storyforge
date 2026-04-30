export interface ReviewChecklistItem {
  id: string;
  label: string;
  detail?: string;
}

/** Ending stage: irreversible canon. */
export const endingReviewChecklist: ReviewChecklistItem[] = [
  { id: 'e1', label: 'Emotional payoff matches genre promise and setup.' },
  { id: 'e2', label: 'Character arcs land — no protagonist contradiction vs earlier canon.' },
  { id: 'e3', label: 'Thematic statement fits the story you want to tell readers.' },
  { id: 'e4', label: 'Stakes and resolution feel earned, not convenient.' },
  { id: 'e5', label: 'No accidental cliffhanger if you intended a closed ending.' },
];

/** Title stage: positioning + discoverability. */
export const titleReviewChecklist: ReviewChecklistItem[] = [
  { id: 't1', label: 'Title fits genre expectations at a glance.' },
  { id: 't2', label: 'No confusion with a famous book you did not intend to echo.' },
  { id: 't3', label: 'Works with your niche / comp positioning.' },
  { id: 't4', label: 'Readable aloud; avoid awkward punctuation stacks.' },
];

/** Chapter approval: continuity and voice. Optional extras from evaluation. */
export function chapterApprovalChecklist(extras: string[] = []): ReviewChecklistItem[] {
  const base: ReviewChecklistItem[] = [
    { id: 'c1', label: 'POV and tense match Story Bible / Creative Brief.' },
    { id: 'c2', label: 'Events align with structure beat and scene goals for this chapter.' },
    { id: 'c3', label: 'No obvious continuity break vs previous approved chapter.' },
    { id: 'c4', label: 'Dialogue and interior voice feel like the same cast as prior chapters.' },
    { id: 'c5', label: 'Hook and closing line serve the larger arc, not just this file.' },
  ];
  const extraItems = extras.filter(Boolean).map((text, i) => ({
    id: `c-x-${i}`,
    label: text,
  }));
  return [...base, ...extraItems];
}

export const chapterOutlinesReviewChecklist: ReviewChecklistItem[] = [
  { id: 'o1', label: 'Chapter count and pacing fit your target length.' },
  { id: 'o2', label: 'Each chapter has a clear scene goal and escalation.' },
  { id: 'o3', label: 'Subplots and B-stories have room to resolve.' },
  { id: 'o4', label: 'Word targets sum to a realistic manuscript total.' },
];

export type ReviewChecklistKey = 'ending' | 'title' | 'chapter-approval' | 'chapter-outlines';

export function checklistItemsForKey(
  key: ReviewChecklistKey,
  options?: { chapterExtras?: string[] }
): ReviewChecklistItem[] {
  switch (key) {
    case 'ending':
      return endingReviewChecklist;
    case 'title':
      return titleReviewChecklist;
    case 'chapter-approval':
      return chapterApprovalChecklist(options?.chapterExtras);
    case 'chapter-outlines':
      return chapterOutlinesReviewChecklist;
    default:
      return [];
  }
}
