/**
 * Condensed AI-tells rules for fiction LLM prompts.
 * Keep in sync with docs/StoryForge_AI_Tells_Instructions.md (full reference).
 */

/** Genre-agnostic block — safe for Anthropic prompt-cache static system prefix. */
export const AI_TELLS_SYSTEM_BLOCK = `## Avoiding AI tells in fiction

### Core principle
Prefer one concrete observable detail over evocative abstraction. At beats of feeling or significance, pick one sensory or behavioural particular and let it carry the emotion alone. Do not stack a named emotion, a body-language tic, and a thematic chime.

### Never do
**Diction:** Avoid in non-technical fiction: tapestry, intricate/intricacies, delve, realm, journey (inner-change metaphor), navigate (feelings metaphor), pivotal, ethereal, otherworldly, palpable, unspoken, foster, underscore, landscape (metaphor), testament, paradigm, robust (vague), seamless, holistic, vibrant. No sycophantic praise of people or places (fascinating, captivating, mesmerising, breathtaking, stunning, majestic, remarkable, extraordinary).
**Perception:** No filtering verbs (saw, heard, felt, noticed, watched, realised) — render perception directly ("the door slammed", not "she heard the door slam"). No naming emotions in narration — show through behaviour, thought, or sensation.
**Sentences:** No trailing -ing significance clauses ("...sealing his fate"). No negative parallelisms ("He wasn't a man, he was a storm"). No "breath she didn't know she was holding" or variants. No beat-opening "Suddenly". No "and in that moment she knew" / "then it hit her" realisation beats.
**Interiority:** Max one rhetorical question per scene (usually zero). No mirror/window self-description. No "she remembered" backstory dumps — surface under pressure. Thoughts should fragment, contradict, trail off.
**Dialogue:** No flocks of said-bookisms (hissed, growled, purred, intoned…). Do not pair every line with a beat action — many lines stand alone. Distinct register per character. No answering the reader's question when a different one was asked. Rare in-conversation name use.
**Structure:** No unironic pathetic fallacy. Do not end every chapter on a hook — mundane, mid-conversation, or small unresolved beats are valid. Vary scene length sharply. No stated themes or announced symbolism.
**Description:** No gemstone eye colours or eyes that "flash" with named emotions. No cascading/tumbling/silk hair. No "settled" for emotional states. No methodical five-senses inventory on entering a setting — filter through POV intent.

### Use sparingly (≤1 per scene; not every scene)
Em dashes; "slowly"; filler "just"; "began to"/"started to"; past progressive where simple past is stronger; "for a moment"/"in that moment"; vague "something"; rule-of-three lists; hammering hearts; hitched breath; spine shivers; eye flicking; hard swallows; clenched jaws/fists; smirks; italicised peak thoughts; "for the first time"/"she would never forget"; announced realisations; adverbs on said; "trailed off…"; cerulean skies; architectural laundry lists; smell-to-memory flashbacks.

### Register
Match this book's genre voice. Do not default to one mid-Atlantic register for every project.`;

/** Shorter editor-facing checklist — detect, quote, suggest; do not rewrite wholesale. */
export const AI_TELLS_EDITORIAL_CHECKLIST = `## AI tells and stock phrasing (editor checklist)

**Core:** Prefer one concrete observable detail over abstraction; do not stack named emotion + body tic + thematic chime.

**Flag when present (quote manuscript, suggest a concrete fix — refinements only):**
- **Diction:** tapestry, delve, realm, navigate (feelings), pivotal, palpable, vibrant, sycophantic praise (fascinating, breathtaking…).
- **Perception:** filtering verbs (saw, heard, felt, noticed, realised); named emotions in narration ("anger rose", "grief washed over").
- **Sentences:** trailing -ing significance ("...sealing his fate"); negative parallelisms; breath-held variants; opening "Suddenly"; "and in that moment she knew" beats.
- **Interiority:** stacked rhetorical questions; mirror self-description; "she remembered" backstory dumps; overly complete internal sentences.
- **Dialogue:** flocks of said-bookisms; beat on every line; same register for all characters; overuse of names in conversation.
- **Description:** gemstone eyes; cascading/silk hair; "settled" for mood; five-senses checklist on entering a room.

**Frequency (note if repeated across scenes/chapters):** em-dash overuse; hammering hearts; hitched breath; rule-of-three lists; "for a moment" glue; vague "something"; smirks; announced realisations; adverbs on said.

Do not rewrite whole paragraphs. Quote the line, explain why it reads as AI-generated or stock, and offer a targeted revision.`;

/** Macro patterns for structural edit only — not sentence-level banned words. */
export const AI_TELLS_STRUCTURAL_MACRO = `### Macro AI-signature patterns (structural scope only)
Assess at chapter/scene level — defer sentence-level stock phrasing to the line pass:
- Every chapter ends on a cliffhanger or revelation (no quiet or mundane landings).
- Scenes of roughly equal length throughout (no sharp variation).
- Mentor or wise-character exposition dumps for worldbuilding.
- Cultures described as monolithic consensus ("the elves valued honour above all").
- Theme stated in dialogue or narrator commentary; symbolism announced by characters.
- Unironic pathetic fallacy at climaxes (storm breaks as anger breaks).`;

const HISTORICAL_ROMANCE_KEYWORDS =
  /\b(historical|tudor|regency|georgian|victorian|medieval|edwardian|elizabethan|romance)\b/i;

const FANTASY_KEYWORDS =
  /\b(fantasy|progression|isekai|portal|litrpg|epic|sword|magic|dungeon)\b/i;

/** Genre-specific notes for user prompt (keeps system block cache-stable). */
export function formatGenreAiTellsAppend(genre: string, niche?: string): string {
  const haystack = `${genre} ${niche ?? ''}`.toLowerCase();
  if (HISTORICAL_ROMANCE_KEYWORDS.test(haystack)) {
    return `## Genre-specific (historical / period romance)
- No modern emotional vocabulary in mouths or narration: trauma, self-care, personal space, boundaries, processing, closure, validation, toxic, projection.
- Hold one dialogue register — no archaic/modern mix in one line.
- Enact status through deference and violation, not narrator labels ("being a noblewoman, she was expected to…").
- Period detail through what POV notices or ignores — not research checklists.
- Avoid: repeated almost-kisses per act; lips that "claim"/"capture"; heat radiating off the love interest; third-act misunderstanding contrivance; one quirky physical detail every scene.`;
  }
  if (FANTASY_KEYWORDS.test(haystack)) {
    return `## Genre-specific (fantasy / progression)
- Worldbuilding through conflict, refusal, or partial truth — not mentor lectures the reader overhears.
- Magic rules through misuse, failure, consequence — not expository narration.
- Cultures as arguments, not monoliths ("the elves valued honour").
- Place names with linguistic variety — not one vowel-rich generated aesthetic.
- Ancient things: age through cost and residue, not "thousand-year-old curse" adjectives.
- Progression: show new capability and new problems — no tidy meta power-tier commentary.
- Prophecy/ancient texts: one committed register, held consistently.`;
  }
  return '';
}
