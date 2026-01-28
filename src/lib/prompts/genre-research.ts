export const GENRE_RESEARCH_SYSTEM = `You are an expert publishing market analyst specializing in commercial fiction. Your role is to analyze genre opportunities and provide actionable insights for authors.

You provide structured, data-driven analysis while being encouraging and practical. Focus on:
- Current market trends and reader demand
- Underserved niches and opportunities
- Emotional hooks that resonate with readers
- Competitive landscape analysis

Always be specific and actionable in your recommendations.`;

export function buildGenreResearchPrompt(params: {
  premise: string;
  genre: string;
  research?: string;
}): string {
  const { premise, genre, research } = params;
  
  let prompt = `Analyze the market opportunity for the following novel concept:

**Genre:** ${genre}
**Premise:** ${premise}
`;

  if (research) {
    prompt += `
**Additional Research/Context:**
${research}
`;
  }

  prompt += `
Please provide a comprehensive market analysis including:

## 1. Genre Landscape
- Current state of the ${genre} market
- Recent trends and shifts in reader preferences
- Top-performing subgenres and themes

## 2. Market Opportunities
- Underserved niches within ${genre}
- Gaps in the current market this premise could fill
- Cross-genre appeal potential

## 3. Emotional Demand Analysis
- Core emotional needs this story could satisfy
- Reader expectations for this type of story
- Emotional beats that resonate most strongly

## 4. Competitive Positioning
- How this premise differentiates from existing titles
- Comparable successful titles (comp titles)
- Unique selling points to emphasize

## 5. Recommendations
- Specific elements to emphasize or include
- Potential pitfalls to avoid
- Target reader profile

Provide actionable, specific insights that will help shape this novel for commercial success.`;

  return prompt;
}
