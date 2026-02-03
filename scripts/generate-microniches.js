const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read the Excel file
const excelPath = path.join(__dirname, '..', 'fiction_microniches_complete.xlsx');
const wb = XLSX.readFile(excelPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

// Map Excel genre/niche names to our internal IDs
// This mapping helps match Excel data to our existing genre/niche structure
const genreMapping = {
  'Fantasy': 'fantasy',
  'Romance': 'romance',
  'Science Fiction': 'science-fiction',
  'Mystery & Thriller': 'mystery-thriller',
  'Horror': 'horror',
  'Literary Fiction': 'literary',
  'Historical Fiction': 'historical',
  'Young Adult': 'young-adult',
  'GameLit & LitRPG': 'gamelit',
  'Other Genres': 'other',
};

// Map niche names from Excel to our niche IDs
// This is a partial mapping - we'll need to match by name similarity
const nicheNameMapping = {
  // Fantasy
  'Cozy Fantasy': 'cozy-fantasy',
  'Romantasy': 'romantasy',
  'Urban Fantasy': 'urban-fantasy',
  'Epic Fantasy': 'epic-fantasy',
  'Portal Fantasy': 'portal-fantasy',
  // Romance
  'Contemporary Romance': 'contemporary-romance',
  'Romantic Comedy': 'romantic-comedy',
  // Science Fiction
  'Cozy Sci-Fi': 'cozy-scifi',
  'Space Opera': 'space-opera',
  'Hard Sci-Fi': 'hard-scifi',
  // Mystery & Thriller
  'Cozy Mystery': 'cozy-mystery',
  // Horror
  'Folk Horror': 'folk-horror',
  // Literary
  'Upmarket Fiction': 'upmarket-fiction',
  // Historical
  'Historical Romance': 'historical-romance',
  'Historical Fantasy': 'historical-fantasy',
  // Young Adult
  'YA Fantasy': 'ya-fantasy',
  'YA Contemporary': 'ya-contemporary',
  'YA Romance': 'ya-romance',
  // GameLit
  'LitRPG': 'litrpg',
  'GameLit': 'gamelit',
  'Cultivation': 'cultivation',
  'Dungeon Core': 'dungeon-core',
  'Isekai': 'isekai',
};

// Group microniches by genre and niche
const micronichesByGenreNiche = {};

data.forEach(row => {
  const genreName = row.Genre;
  const nicheName = row.Niche;
  const micronicheName = row.Microniche;
  const description = row.Description || '';
  
  if (!genreName || !nicheName || !micronicheName) {
    return;
  }
  
  const genreId = genreMapping[genreName];
  if (!genreId) {
    return; // Skip unmapped genres
  }
  
  // Try to find matching niche ID
  let nicheId = nicheNameMapping[nicheName];
  
  // If no direct mapping, try to match by name similarity
  if (!nicheId) {
    // Normalize names for comparison (lowercase, remove special chars)
    const normalizedNicheName = nicheName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    // We'll handle this in the TypeScript file by matching names
  }
  
  if (!micronichesByGenreNiche[genreId]) {
    micronichesByGenreNiche[genreId] = {};
  }
  
  if (!micronichesByGenreNiche[genreId][nicheName]) {
    micronichesByGenreNiche[genreId][nicheName] = [];
  }
  
  // Create microniche ID from name
  const micronicheId = micronicheName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  micronichesByGenreNiche[genreId][nicheName].push({
    id: micronicheId,
    name: micronicheName,
    description: description,
  });
});

// Generate TypeScript code
let output = `// Auto-generated microniche data from fiction_microniches_complete.xlsx
// DO NOT EDIT MANUALLY - Regenerate using: node scripts/generate-microniches.js

export interface Microniche {
  id: string;
  name: string;
  description: string;
}

// Microniches grouped by genre ID, then by niche name (to match with existing niches)
export const MICRONICHES_BY_GENRE_NICHE: Record<string, Record<string, Microniche[]>> = ${JSON.stringify(micronichesByGenreNiche, null, 2)};

// Helper function to get microniches for a specific niche
// Takes genre ID and niche name (as it appears in Excel) and returns microniches
export function getMicronichesByNicheName(genreId: string, nicheName: string): Microniche[] {
  return MICRONICHES_BY_GENRE_NICHE[genreId]?.[nicheName] || [];
}

// Helper function to find microniche by ID
export function getMicronicheById(micronicheId: string): Microniche | undefined {
  for (const genreNiches of Object.values(MICRONICHES_BY_GENRE_NICHE)) {
    for (const microniches of Object.values(genreNiches)) {
      const found = microniches.find(m => m.id === micronicheId);
      if (found) return found;
    }
  }
  return undefined;
}
`;

// Write to file
const outputPath = path.join(__dirname, '..', 'src', 'lib', 'data', 'microniches.ts');
fs.writeFileSync(outputPath, output, 'utf8');

console.log(`✅ Generated microniches data at ${outputPath}`);
console.log(`\nSummary:`);
Object.keys(micronichesByGenreNiche).forEach(genreId => {
  const niches = micronichesByGenreNiche[genreId];
  const totalMicroniches = Object.values(niches).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`  ${genreId}: ${Object.keys(niches).length} niches, ${totalMicroniches} microniches`);
});
