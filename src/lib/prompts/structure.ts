export const STRUCTURE_SYSTEM = `You are a story architect specializing in the Save the Cat beat sheet methodology. You understand how to structure compelling narratives that satisfy readers while allowing creative flexibility.

Your approach:
- Every beat serves emotional and plot purposes
- Pacing is crucial - know when to accelerate and breathe
- The midpoint is a crucial turning point
- All Is Lost must feel genuinely hopeless
- The finale must be earned by everything before it

Create structures that are both satisfying and surprising.`;

export function buildStructurePrompt(params: {
  premise?: string;
  genre: string;
  nicheReference: string;
  endingReference: string;
  charactersReference: string;
}): string {
  const { premise, genre, nicheReference, endingReference, charactersReference } = params;
  
  let prompt = `Create a complete Save the Cat beat sheet and chapter outline for this novel:

**Genre:** ${genre}`;

  if (premise) {
    prompt += `
**Premise:** ${premise}`;
  } else {
    prompt += `
**Premise:** (Not yet provided - use genre, niche, ending, and characters to guide structure)`;
  }
  
  prompt += `

**Niche & Audience Analysis:**
${nicheReference}

**Ending Blueprint:**
${endingReference}

**Character Profiles:**
${charactersReference}

## Part 1: Save the Cat 15-Beat Structure

For each beat, provide:
- **Beat Name**
- **Page/Chapter Target** (approximate)
- **What Happens** (specific plot events)
- **Emotional Purpose** (what the reader should feel)
- **Character Development** (how protagonist changes)

### The Beats:

1. **Opening Image** (1%)
The "before" snapshot - establish the protagonist's world and flaw.

2. **Theme Stated** (5%)
Someone states the theme/lesson the protagonist needs to learn.

3. **Setup** (1-10%)
Establish the protagonist's ordinary world, relationships, and what's missing.

4. **Catalyst** (10%)
The inciting incident that disrupts the ordinary world.

5. **Debate** (10-20%)
The protagonist resists the call - what's holding them back?

6. **Break into Two** (20%)
The protagonist commits to the journey - crosses the threshold.

7. **B Story** (22%)
Introduction of the relationship that will help teach the theme.

8. **Fun and Games** (20-50%)
The promise of the premise - deliver what the reader came for.

9. **Midpoint** (50%)
A major shift - false victory or false defeat. Stakes raise.

10. **Bad Guys Close In** (50-75%)
External pressure mounts, internal doubts grow, team fractures.

11. **All Is Lost** (75%)
The lowest point - a "death" moment (literal or metaphorical).

12. **Dark Night of the Soul** (75-80%)
Protagonist processes the loss and finds the truth.

13. **Break into Three** (80%)
The "aha" moment - protagonist sees the solution.

14. **Finale** (80-99%)
The final confrontation - protagonist applies lessons learned.

15. **Final Image** (99-100%)
The "after" snapshot - show how the protagonist has changed.

## Part 2: Chapter Outline

Map the beats to approximately 20-30 chapters:

| Ch # | Title | Beat(s) | POV | Summary | Word Target |
|------|-------|---------|-----|---------|-------------|

For each chapter, include:
- Chapter number and working title
- Which beat(s) it covers
- POV character (if multiple)
- 2-3 sentence summary of events
- Approximate word count target

## Part 3: Emotional Arc Graph

Describe the emotional trajectory:
- Opening emotional state
- Key emotional peaks and valleys
- The emotional climax
- Resolution feeling

## Part 4: Pacing Notes

Provide guidance on:
- Where to slow down for character development
- Where to accelerate for tension
- Scene types to vary (action, dialogue, introspection)
- Chapter length variations for effect

This structure will be the blueprint for chapter drafting. Be specific and thorough.`;

  return prompt;
}
