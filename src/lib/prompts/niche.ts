export const NICHE_SYSTEM = `You are a publishing strategist specializing in audience targeting and brand positioning for fiction authors. You help authors understand their ideal readers and craft compelling promises.

Your analysis should be:
- Specific and actionable
- Grounded in reader psychology
- Focused on emotional connection
- Practical for marketing purposes`;

export function buildNichePrompt(params: {
  premise: string;
  genre: string;
  genreResearch: string;
}): string {
  const { premise, genre, genreResearch } = params;
  
  return `Based on the following novel concept and market research, develop a comprehensive niche positioning strategy:

**Genre:** ${genre}
**Premise:** ${premise}

**Market Research Summary:**
${genreResearch}

Please provide:

## 1. Reader Avatar
Create a detailed profile of the ideal reader:
- Demographics (age range, typical background)
- Reading habits and preferences
- Other authors/series they love
- What they're looking for in a book
- Their emotional state when picking up this type of book
- Where they discover new books

## 2. Emotional Promise
Define the core emotional experience this book will deliver:
- Primary emotional payoff
- Secondary emotional threads
- The "feeling" readers should have when they finish
- One-sentence emotional promise

## 3. Tropes & Conventions

### Must Include (Reader Expectations)
List 5-7 tropes or elements readers of this niche expect and will be disappointed without.

### Consider Including (Differentiators)
List 3-5 fresh elements or twists that could make this book stand out.

### Avoid (Reader Turn-offs)
List 3-5 elements that would alienate the target audience.

## 4. Positioning Statement
Write a clear positioning statement in this format:
"For [target reader] who wants [emotional need], [Book Title] is a [genre] that delivers [unique promise]. Unlike [alternatives], this book [key differentiator]."

## 5. Marketing Hooks
Provide 3-5 potential taglines or hooks that could be used in marketing.

Be specific and actionable. This analysis will guide the entire creative process.`;
}
