// Comprehensive genre and niche data for novel creation
// Focuses on underserved and emerging niches alongside traditional genres

export interface Niche {
  id: string;
  name: string;
  description: string;
  keywords: string[];
}

export interface Genre {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  niches: Niche[];
}

export const GENRES: Genre[] = [
  {
    id: 'fantasy',
    name: 'Fantasy',
    description: 'Stories with magic, mythical creatures, and otherworldly settings',
    icon: '✨',
    color: '#8B5CF6',
    niches: [
      {
        id: 'cozy-fantasy',
        name: 'Cozy Fantasy',
        description: 'Low-stakes, comfort-focused fantasy with warm atmospheres and found family',
        keywords: ['comfort', 'low-stakes', 'found family', 'slice of life'],
      },
      {
        id: 'romantasy',
        name: 'Romantasy',
        description: 'Fantasy with romance at its core, blending epic worlds with love stories',
        keywords: ['romance', 'fantasy romance', 'love interest', 'slow burn'],
      },
      {
        id: 'progression-fantasy',
        name: 'Progression Fantasy',
        description: 'Characters grow stronger through training, leveling, or skill acquisition',
        keywords: ['power progression', 'training', 'leveling', 'magic system'],
      },
      {
        id: 'gaslamp-fantasy',
        name: 'Gaslamp Fantasy',
        description: 'Victorian-era settings with magic, mystery, and industrial aesthetics',
        keywords: ['victorian', 'steampunk-adjacent', 'gothic', 'industrial'],
      },
      {
        id: 'portal-fantasy',
        name: 'Portal Fantasy',
        description: 'Characters transported from our world to magical realms',
        keywords: ['isekai', 'transported', 'fish out of water', 'new world'],
      },
      {
        id: 'dark-fantasy',
        name: 'Dark Fantasy',
        description: 'Gritty, morally complex fantasy with horror elements',
        keywords: ['grimdark', 'morally grey', 'dark themes', 'anti-hero'],
      },
      {
        id: 'mythic-fantasy',
        name: 'Mythic Fantasy',
        description: 'Stories rooted in mythology, folklore, and legend retellings',
        keywords: ['mythology', 'folklore', 'retelling', 'gods'],
      },
      {
        id: 'urban-fantasy',
        name: 'Urban Fantasy',
        description: 'Magic hidden within modern cities and contemporary settings',
        keywords: ['modern', 'hidden magic', 'paranormal', 'city'],
      },
      {
        id: 'epic-fantasy',
        name: 'Epic Fantasy',
        description: 'Grand-scale adventures with world-changing stakes and large casts',
        keywords: ['high fantasy', 'quest', 'chosen one', 'world-building'],
      },
      {
        id: 'fairy-tale-retelling',
        name: 'Fairy Tale Retelling',
        description: 'Classic fairy tales reimagined with fresh perspectives',
        keywords: ['retelling', 'classic', 'twist', 'reimagined'],
      },
    ],
  },
  {
    id: 'romance',
    name: 'Romance',
    description: 'Love stories with emotionally satisfying endings',
    icon: '💕',
    color: '#EC4899',
    niches: [
      {
        id: 'sapphic-romance',
        name: 'Sapphic Romance',
        description: 'Romance between women, WLW love stories',
        keywords: ['WLW', 'lesbian', 'queer women', 'f/f'],
      },
      {
        id: 'mm-romance',
        name: 'MM Romance',
        description: 'Romance between men, MLM love stories',
        keywords: ['MLM', 'gay romance', 'm/m', 'queer men'],
      },
      {
        id: 'polyamorous-romance',
        name: 'Polyamorous Romance',
        description: 'Love stories featuring multiple partners in ethical non-monogamy',
        keywords: ['polyamory', 'throuple', 'multiple partners', 'ENM'],
      },
      {
        id: 'later-in-life-romance',
        name: 'Later-in-Life Romance',
        description: 'Love stories featuring protagonists 40+ finding love',
        keywords: ['mature protagonists', 'second chance', 'midlife', 'silver romance'],
      },
      {
        id: 'disability-romance',
        name: 'Disability Romance',
        description: 'Love stories centering disabled protagonists with authentic representation',
        keywords: ['disability rep', 'chronic illness', 'neurodivergent', 'accessibility'],
      },
      {
        id: 'slow-burn-romance',
        name: 'Slow Burn Romance',
        description: 'Tension-filled romances where feelings develop gradually',
        keywords: ['slow burn', 'tension', 'gradual', 'longing'],
      },
      {
        id: 'enemies-to-lovers',
        name: 'Enemies to Lovers',
        description: 'Rivals or adversaries who fall in love despite their conflicts',
        keywords: ['enemies', 'rivals', 'hate to love', 'tension'],
      },
      {
        id: 'found-family-romance',
        name: 'Found Family Romance',
        description: 'Romance intertwined with building chosen family connections',
        keywords: ['found family', 'chosen family', 'community', 'belonging'],
      },
      {
        id: 'dark-romance',
        name: 'Dark Romance',
        description: 'Intense romances exploring darker themes and morally complex characters',
        keywords: ['dark themes', 'morally grey', 'intense', 'taboo'],
      },
      {
        id: 'contemporary-romance',
        name: 'Contemporary Romance',
        description: 'Modern-day love stories in realistic settings',
        keywords: ['modern', 'realistic', 'everyday', 'relatable'],
      },
      {
        id: 'historical-romance',
        name: 'Historical Romance',
        description: 'Love stories set in past eras with period-accurate details',
        keywords: ['historical', 'regency', 'victorian', 'period'],
      },
      {
        id: 'romantic-comedy',
        name: 'Romantic Comedy',
        description: 'Light-hearted romances with humor and witty banter',
        keywords: ['romcom', 'funny', 'banter', 'light-hearted'],
      },
    ],
  },
  {
    id: 'science-fiction',
    name: 'Science Fiction',
    description: 'Speculative stories exploring technology, space, and future possibilities',
    icon: '🚀',
    color: '#06B6D4',
    niches: [
      {
        id: 'solarpunk',
        name: 'Solarpunk',
        description: 'Optimistic futures with sustainable technology and ecological harmony',
        keywords: ['optimistic', 'sustainable', 'green tech', 'hopeful future'],
      },
      {
        id: 'hopepunk',
        name: 'Hopepunk',
        description: 'Stories where hope and kindness are acts of rebellion',
        keywords: ['hope', 'kindness', 'resistance', 'optimism'],
      },
      {
        id: 'cozy-scifi',
        name: 'Cozy Sci-Fi',
        description: 'Low-stakes science fiction focused on character and comfort',
        keywords: ['comfort', 'low-stakes', 'slice of life', 'gentle'],
      },
      {
        id: 'space-opera',
        name: 'Space Opera',
        description: 'Epic adventures across galaxies with grand scope and drama',
        keywords: ['space', 'epic', 'galactic', 'adventure'],
      },
      {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        description: 'High-tech, low-life futures with corporate dystopias and hackers',
        keywords: ['dystopia', 'hackers', 'corporate', 'neon'],
      },
      {
        id: 'biopunk',
        name: 'Biopunk',
        description: 'Biotechnology-focused futures exploring genetic engineering and body modification',
        keywords: ['biotech', 'genetic', 'body modification', 'organic tech'],
      },
      {
        id: 'climate-fiction',
        name: 'Climate Fiction',
        description: 'Stories exploring climate change impacts and environmental futures',
        keywords: ['cli-fi', 'climate change', 'environmental', 'ecological'],
      },
      {
        id: 'first-contact',
        name: 'First Contact',
        description: 'Humanity\'s first encounter with alien civilizations',
        keywords: ['aliens', 'contact', 'communication', 'discovery'],
      },
      {
        id: 'hard-scifi',
        name: 'Hard Sci-Fi',
        description: 'Scientifically rigorous speculation grounded in real physics',
        keywords: ['scientific accuracy', 'physics', 'realistic', 'technical'],
      },
      {
        id: 'space-colonization',
        name: 'Space Colonization',
        description: 'Stories of humanity settling new worlds and building societies',
        keywords: ['colonization', 'settlement', 'terraforming', 'new worlds'],
      },
    ],
  },
  {
    id: 'mystery-thriller',
    name: 'Mystery & Thriller',
    description: 'Suspenseful stories with puzzles to solve and tension to unravel',
    icon: '🔍',
    color: '#F59E0B',
    niches: [
      {
        id: 'cozy-mystery',
        name: 'Cozy Mystery',
        description: 'Amateur sleuths solving crimes in charming small-town settings',
        keywords: ['amateur sleuth', 'small town', 'no graphic violence', 'charming'],
      },
      {
        id: 'amateur-sleuth',
        name: 'Amateur Sleuth',
        description: 'Non-professional detectives investigating crimes',
        keywords: ['amateur detective', 'civilian', 'investigation', 'puzzle'],
      },
      {
        id: 'locked-room',
        name: 'Locked Room Mystery',
        description: 'Impossible crimes in sealed environments',
        keywords: ['impossible crime', 'puzzle', 'closed circle', 'whodunit'],
      },
      {
        id: 'psychological-thriller',
        name: 'Psychological Thriller',
        description: 'Mind games, unreliable narrators, and psychological tension',
        keywords: ['psychological', 'mind games', 'unreliable narrator', 'tension'],
      },
      {
        id: 'domestic-thriller',
        name: 'Domestic Thriller',
        description: 'Suspense within families and intimate relationships',
        keywords: ['domestic', 'family secrets', 'marriage', 'home'],
      },
      {
        id: 'noir',
        name: 'Noir',
        description: 'Dark, cynical crime stories with morally ambiguous characters',
        keywords: ['dark', 'cynical', 'crime', 'morally grey'],
      },
      {
        id: 'police-procedural',
        name: 'Police Procedural',
        description: 'Realistic depictions of law enforcement investigations',
        keywords: ['police', 'investigation', 'procedural', 'detective'],
      },
      {
        id: 'legal-thriller',
        name: 'Legal Thriller',
        description: 'Courtroom drama and legal system intrigue',
        keywords: ['legal', 'courtroom', 'lawyer', 'justice'],
      },
      {
        id: 'espionage-thriller',
        name: 'Espionage Thriller',
        description: 'Spy stories with international intrigue and covert operations',
        keywords: ['spy', 'espionage', 'covert', 'international'],
      },
    ],
  },
  {
    id: 'horror',
    name: 'Horror',
    description: 'Stories designed to frighten, unsettle, and explore dark themes',
    icon: '👻',
    color: '#7C3AED',
    niches: [
      {
        id: 'folk-horror',
        name: 'Folk Horror',
        description: 'Rural settings, ancient traditions, and pagan rituals gone wrong',
        keywords: ['rural', 'pagan', 'traditions', 'isolation'],
      },
      {
        id: 'gothic-horror',
        name: 'Gothic Horror',
        description: 'Atmospheric dread in decaying mansions and haunted places',
        keywords: ['gothic', 'atmosphere', 'haunted', 'decay'],
      },
      {
        id: 'cosmic-horror',
        name: 'Cosmic Horror',
        description: 'Lovecraftian dread of humanity\'s insignificance in the universe',
        keywords: ['cosmic', 'lovecraftian', 'existential', 'unknowable'],
      },
      {
        id: 'quiet-horror',
        name: 'Quiet Horror',
        description: 'Subtle, creeping dread rather than shock and gore',
        keywords: ['subtle', 'creeping dread', 'atmospheric', 'literary'],
      },
      {
        id: 'southern-gothic',
        name: 'Southern Gothic',
        description: 'American South settings with decay, grotesque, and social critique',
        keywords: ['southern', 'grotesque', 'decay', 'social commentary'],
      },
      {
        id: 'body-horror',
        name: 'Body Horror',
        description: 'Terror through physical transformation and bodily violation',
        keywords: ['body', 'transformation', 'visceral', 'physical'],
      },
      {
        id: 'paranormal-horror',
        name: 'Paranormal Horror',
        description: 'Ghosts, hauntings, and supernatural entities',
        keywords: ['ghosts', 'haunting', 'supernatural', 'paranormal'],
      },
      {
        id: 'psychological-horror',
        name: 'Psychological Horror',
        description: 'Horror rooted in the mind, sanity, and perception',
        keywords: ['psychological', 'sanity', 'mind', 'perception'],
      },
    ],
  },
  {
    id: 'literary',
    name: 'Literary Fiction',
    description: 'Character-driven stories with artistic prose and thematic depth',
    icon: '📚',
    color: '#059669',
    niches: [
      {
        id: 'upmarket-fiction',
        name: 'Upmarket Fiction',
        description: 'Commercially appealing stories with literary sensibilities',
        keywords: ['book club', 'accessible', 'literary commercial', 'crossover'],
      },
      {
        id: 'book-club-fiction',
        name: 'Book Club Fiction',
        description: 'Discussion-worthy stories perfect for reading groups',
        keywords: ['book club', 'discussion', 'accessible', 'thought-provoking'],
      },
      {
        id: 'magical-realism',
        name: 'Magical Realism',
        description: 'Subtle magic woven into realistic, literary narratives',
        keywords: ['magical realism', 'subtle magic', 'literary', 'surreal'],
      },
      {
        id: 'speculative-literary',
        name: 'Speculative Literary',
        description: 'Literary fiction with speculative elements and what-if premises',
        keywords: ['speculative', 'literary', 'what-if', 'alternate'],
      },
      {
        id: 'family-saga',
        name: 'Family Saga',
        description: 'Multi-generational stories exploring family dynamics over time',
        keywords: ['family', 'generations', 'saga', 'legacy'],
      },
      {
        id: 'coming-of-age',
        name: 'Coming of Age',
        description: 'Stories of growth, identity formation, and transition to adulthood',
        keywords: ['coming of age', 'growth', 'identity', 'youth'],
      },
    ],
  },
  {
    id: 'historical',
    name: 'Historical Fiction',
    description: 'Stories set in the past, bringing history to life',
    icon: '🏛️',
    color: '#B45309',
    niches: [
      {
        id: 'historical-fantasy',
        name: 'Historical Fantasy',
        description: 'Real historical periods infused with magical elements',
        keywords: ['historical', 'fantasy', 'magic', 'period'],
      },
      {
        id: 'alternate-history',
        name: 'Alternate History',
        description: 'What if history had taken a different path?',
        keywords: ['alternate', 'what-if', 'divergence', 'history'],
      },
      {
        id: 'regency',
        name: 'Regency Era',
        description: 'Stories set in early 19th century England',
        keywords: ['regency', 'england', 'society', 'manners'],
      },
      {
        id: 'medieval',
        name: 'Medieval',
        description: 'Stories set in the Middle Ages',
        keywords: ['medieval', 'knights', 'castles', 'feudal'],
      },
      {
        id: 'wwii',
        name: 'World War II',
        description: 'Stories set during the Second World War',
        keywords: ['wwii', 'war', '1940s', 'resistance'],
      },
      {
        id: 'ancient-world',
        name: 'Ancient World',
        description: 'Stories set in ancient civilizations',
        keywords: ['ancient', 'rome', 'greece', 'egypt'],
      },
    ],
  },
  {
    id: 'young-adult',
    name: 'Young Adult',
    description: 'Stories featuring teenage protagonists navigating identity and growth',
    icon: '🌟',
    color: '#F472B6',
    niches: [
      {
        id: 'ya-fantasy',
        name: 'YA Fantasy',
        description: 'Fantasy adventures with young adult protagonists',
        keywords: ['ya', 'fantasy', 'teen', 'magic'],
      },
      {
        id: 'ya-contemporary',
        name: 'YA Contemporary',
        description: 'Realistic stories about modern teen life',
        keywords: ['ya', 'contemporary', 'realistic', 'modern'],
      },
      {
        id: 'ya-romance',
        name: 'YA Romance',
        description: 'First love and teen romance stories',
        keywords: ['ya', 'romance', 'first love', 'teen'],
      },
      {
        id: 'ya-thriller',
        name: 'YA Thriller',
        description: 'Suspenseful stories for young adult readers',
        keywords: ['ya', 'thriller', 'suspense', 'mystery'],
      },
      {
        id: 'new-adult',
        name: 'New Adult',
        description: 'Stories bridging YA and adult, featuring 18-25 year olds',
        keywords: ['new adult', 'college', 'early twenties', 'transition'],
      },
    ],
  },
  {
    id: 'gamelit',
    name: 'GameLit & LitRPG',
    description: 'Stories featuring game mechanics, progression systems, and virtual worlds',
    icon: '🎮',
    color: '#10B981',
    niches: [
      {
        id: 'litrpg',
        name: 'LitRPG',
        description: 'Stories with explicit game mechanics, stats, and leveling systems',
        keywords: ['litrpg', 'stats', 'leveling', 'game mechanics'],
      },
      {
        id: 'gamelit',
        name: 'GameLit',
        description: 'Game-inspired stories without heavy mechanical focus',
        keywords: ['gamelit', 'game-inspired', 'virtual world', 'gaming'],
      },
      {
        id: 'cultivation',
        name: 'Cultivation',
        description: 'Eastern-inspired progression through martial arts and spiritual cultivation',
        keywords: ['cultivation', 'xianxia', 'martial arts', 'qi'],
      },
      {
        id: 'dungeon-core',
        name: 'Dungeon Core',
        description: 'Protagonist is or manages a dungeon, building and defending',
        keywords: ['dungeon', 'building', 'management', 'defense'],
      },
      {
        id: 'isekai',
        name: 'Isekai',
        description: 'Transported to another world, often game-like',
        keywords: ['isekai', 'transported', 'reincarnation', 'another world'],
      },
    ],
  },
  {
    id: 'other',
    name: 'Other Genres',
    description: 'Additional genres and unique category combinations',
    icon: '📖',
    color: '#6B7280',
    niches: [
      {
        id: 'slice-of-life',
        name: 'Slice of Life',
        description: 'Everyday moments and character-focused storytelling',
        keywords: ['slice of life', 'everyday', 'character-focused', 'gentle'],
      },
      {
        id: 'western',
        name: 'Western',
        description: 'Stories set in the American Old West',
        keywords: ['western', 'frontier', 'cowboys', 'old west'],
      },
      {
        id: 'adventure',
        name: 'Adventure',
        description: 'Action-packed journeys and exploration',
        keywords: ['adventure', 'journey', 'exploration', 'action'],
      },
      {
        id: 'satire',
        name: 'Satire',
        description: 'Humorous critique of society and human nature',
        keywords: ['satire', 'humor', 'critique', 'social commentary'],
      },
      {
        id: 'anthologies',
        name: 'Short Story Collection',
        description: 'Connected short stories or novellas',
        keywords: ['short stories', 'anthology', 'collection', 'novellas'],
      },
    ],
  },
];

// Helper function to get all niches as a flat array
export function getAllNiches(): (Niche & { genreId: string; genreName: string })[] {
  return GENRES.flatMap((genre) =>
    genre.niches.map((niche) => ({
      ...niche,
      genreId: genre.id,
      genreName: genre.name,
    }))
  );
}

// Helper function to get niches for a specific genre
export function getNichesByGenre(genreId: string): Niche[] {
  const genre = GENRES.find((g) => g.id === genreId);
  return genre?.niches || [];
}

// Helper function to find a genre by ID
export function getGenreById(genreId: string): Genre | undefined {
  return GENRES.find((g) => g.id === genreId);
}

// Helper function to find a niche by ID
export function getNicheById(nicheId: string): (Niche & { genreId: string; genreName: string }) | undefined {
  for (const genre of GENRES) {
    const niche = genre.niches.find((n) => n.id === nicheId);
    if (niche) {
      return {
        ...niche,
        genreId: genre.id,
        genreName: genre.name,
      };
    }
  }
  return undefined;
}

// Helper to get display name combining genre and niche
export function getGenreNicheDisplay(genreId: string, nicheId?: string): string {
  const genre = getGenreById(genreId);
  if (!genre) return 'Unknown Genre';
  
  if (!nicheId) return genre.name;
  
  const niche = genre.niches.find((n) => n.id === nicheId);
  if (!niche) return genre.name;
  
  return `${genre.name} • ${niche.name}`;
}
