export const ENDING_SYSTEM = `You are a master storyteller and developmental editor specializing in crafting satisfying, emotionally resonant endings. You understand that great endings are earned through proper setup and deliver on the story's emotional promise.

Your approach:
- Endings should feel both surprising and inevitable
- Emotional payoff is paramount
- Character arcs must complete satisfyingly
- Thematic resonance ties everything together
- The ending should honor genre expectations while offering something fresh`;

export function buildEndingConceptsPrompt(params: {
  premise?: string;
  genre: string;
  nicheReference: string;
}): string {
  const { premise, genre, nicheReference } = params;
  
  let prompt = `Generate 8-10 potential ending concepts for this novel:

**Genre:** ${genre}`;

  if (premise) {
    prompt += `
**Premise:** ${premise}`;
  } else {
    prompt += `
**Premise:** (Not yet provided - use genre and niche analysis to guide ending concepts)`;
  }
  
  prompt += `

**Niche & Audience Analysis:**
${nicheReference}

For each ending concept, provide:

1. **Title**: A short, evocative name for this ending type
2. **Summary**: Maximum 2 sentences describing how the story concludes
3. **Emotional Payoff**: The primary feeling readers will experience
4. **Character Resolution**: How the protagonist's arc completes
5. **Thematic Statement**: What truth about life/humanity this ending affirms

Generate a diverse range of endings:
- At least 2 that lean into genre expectations (satisfying, expected)
- At least 2 that subvert expectations in interesting ways
- At least 2 that are bittersweet or complex
- At least 2 that are triumphant/uplifting

Number each concept clearly (1-10) for easy reference.

Remember: The ending determines everything that comes before it. These concepts will shape the entire story structure.`;

  return prompt;
}

export function buildEndingExpansionPrompt(params: {
  premise?: string;
  genre: string;
  nicheReference: string;
  selectedEnding: string;
}): string {
  const { premise, genre, nicheReference, selectedEnding } = params;
  
  let prompt = `Expand the selected ending concept into a detailed ending blueprint:

**Genre:** ${genre}`;

  if (premise) {
    prompt += `
**Premise:** ${premise}`;
  } else {
    prompt += `
**Premise:** (Not yet provided - use genre and niche analysis to guide ending development)`;
  }
  
  prompt += `

**Niche & Audience Analysis:**
${nicheReference}

**Selected Ending Concept:**
${selectedEnding}

Please develop this ending in full detail:

## 1. Final Scene Vision
Describe the final scene(s) in vivid detail:
- Setting and atmosphere
- Who is present
- Key actions and dialogue beats
- Sensory details that create emotional impact
- The final image/moment readers will remember

## 2. Climax Requirements
What must happen in the climax to earn this ending:
- The central confrontation or decision
- What the protagonist must sacrifice or overcome
- The moment of transformation
- Stakes that must be established earlier

## 3. Emotional Arc Completion
How the protagonist's emotional journey concludes:
- Their starting emotional state (to be established in Act 1)
- The wound or flaw they carry
- How this ending represents healing/growth
- The internal shift that makes the external resolution possible

## 4. Key Reversals Needed
Plot elements that must be set up earlier to pay off:
- Promises made to the reader that this ending fulfills
- Chekhov's guns that need to be planted
- Relationships that need development
- Information that needs to be withheld then revealed

## 5. Thematic Resonance
How this ending delivers the story's message:
- The central theme this ending embodies
- Symbolic elements that reinforce meaning
- What readers should understand about life/humanity
- The lasting impression this creates

## 6. Sequel/Series Potential (if applicable)
- Does this ending close the story completely or leave threads?
- What questions are answered vs. left open?
- Potential for continuation while still being satisfying standalone

This ending blueprint will guide all story development. Be specific and thorough.`;

  return prompt;
}
