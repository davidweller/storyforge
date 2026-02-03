const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read the Excel file
const excelPath = path.join(__dirname, '..', 'fiction_microniches_complete.xlsx');
const wb = XLSX.readFile(excelPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

console.log('Columns:', Object.keys(data[0] || {}));
console.log('Total rows:', data.length);
console.log('\nFirst 5 rows:');
console.log(JSON.stringify(data.slice(0, 5), null, 2));

// Group by Genre -> Niche -> Microniche
const structure = {};

data.forEach(row => {
  const genre = row.Genre || row.genre;
  const niche = row.Niche || row.niche;
  const microniche = row.Microniche || row.microniche;
  
  if (!genre || !niche || !microniche) {
    return; // Skip incomplete rows
  }
  
  if (!structure[genre]) {
    structure[genre] = {};
  }
  
  if (!structure[genre][niche]) {
    structure[genre][niche] = [];
  }
  
  if (!structure[genre][niche].includes(microniche)) {
    structure[genre][niche].push(microniche);
  }
});

console.log('\nStructure summary:');
Object.keys(structure).forEach(genre => {
  console.log(`\n${genre}:`);
  Object.keys(structure[genre]).forEach(niche => {
    console.log(`  ${niche}: ${structure[genre][niche].length} microniches`);
  });
});
