export const CHARACTERS_SYSTEM = `You are a character development specialist with deep expertise in creating memorable, three-dimensional characters that serve both story and theme. You understand:

- Characters must have clear wants, needs, and flaws
- Relationships create conflict and growth opportunities
- Character arcs should mirror and support thematic content
- Distinctive voices and mannerisms make characters memorable
- Supporting characters should have their own agency and goals

Create characters that feel real, serve the story, and resonate with readers.`;

export function buildCharactersPrompt(params: {
  premise?: string;
  genre: string;
  nicheReference: string;
  endingReference: string;
}): string {
  const { premise, genre, nicheReference, endingReference } = params;
  
  let prompt = `Design the complete cast of characters for this novel:

**Genre:** ${genre}`;

  if (premise) {
    prompt += `
**Premise:** ${premise}`;
  } else {
    prompt += `
**Premise:** (Not yet provided - use genre, niche, and ending to guide character design)`;
  }
  
  prompt += `

**Niche & Audience Analysis:**
${nicheReference}

**Ending Blueprint:**
${endingReference}

## Required Output:

### 1. Character List
First, provide a quick reference list of all characters:
| Name | Role | One-Line Description |
|------|------|---------------------|
(Include 5-10 significant characters)

### 2. Protagonist Profile

**Basic Information**
- Full Name:
- Age:
- Occupation/Role:
- Physical Description (distinctive features):

**Psychology**
- Core Want (external goal):
- Core Need (internal/emotional):
- Fatal Flaw:
- Greatest Fear:
- Ghost/Wound (past trauma shaping them):
- Lie They Believe:
- Truth They Must Learn:

**Voice & Mannerisms**
- Speech patterns:
- Physical habits/tics:
- How they relate to others:

**Arc Summary**
- Starting State:
- Midpoint Shift:
- End State:
- Key Transformation Moment:

### 3. Antagonist/Opposition Profile
(Same structure as protagonist, adapted for their role)

### 4. Key Supporting Characters
For each supporting character (3-5 characters):
- Name & Role:
- Relationship to Protagonist:
- Their Own Goal:
- How They Challenge/Support Protagonist:
- Key Function in Plot:
- Distinctive Trait:

### 5. Relationship Map
Describe the key relationships and their dynamics:
- Protagonist ↔ Antagonist:
- Protagonist ↔ Love Interest (if applicable):
- Protagonist ↔ Mentor/Ally:
- Protagonist ↔ Friend/Sidekick:
- Key Conflict Relationships:
- Key Support Relationships:

### 6. Character Constellation
Explain how the cast works together:
- How do characters represent different aspects of the theme?
- What contrasts and parallels exist between characters?
- How do relationships evolve through the story?

Create characters that readers will remember and care about. Every character should have a purpose.`;

  return prompt;
}
