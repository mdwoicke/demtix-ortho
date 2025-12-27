const fs = require('fs');
const data = JSON.parse(fs.readFileSync('Ortho_Chatflow_latest.json', 'utf8'));

const toolAgent = data.nodes.find(n => n.id === 'toolAgent_0');
const systemMessage = toolAgent.data.inputs.systemMessage;

console.log('=== Checking for hidden/special characters ===\n');

// Check for any non-printable or unusual characters
const unusualChars = [];
for (let i = 0; i < systemMessage.length; i++) {
  const code = systemMessage.charCodeAt(i);
  // Flag if:
  // - Not in printable ASCII range (32-126)
  // - Not newline (10), carriage return (13), tab (9)
  // - Unicode weirdness
  if (code < 32 && code !== 10 && code !== 13 && code !== 9) {
    unusualChars.push({ pos: i, char: systemMessage[i], code, context: systemMessage.substring(Math.max(0, i-10), i+10) });
  }
  if (code > 126 && code < 160) {
    unusualChars.push({ pos: i, char: systemMessage[i], code, context: systemMessage.substring(Math.max(0, i-10), i+10) });
  }
}

console.log('Unusual characters found:', unusualChars.length);
unusualChars.forEach((u, idx) => {
  console.log((idx+1) + '. Position:', u.pos, 'Code:', u.code);
  console.log('   Context:', JSON.stringify(u.context));
});

// Check for zero-width characters or invisible Unicode
console.log('\n=== Checking for zero-width/invisible Unicode ===');
const zeroWidthPatterns = [
  { name: 'Zero-width space', pattern: /\u200B/g },
  { name: 'Zero-width non-joiner', pattern: /\u200C/g },
  { name: 'Zero-width joiner', pattern: /\u200D/g },
  { name: 'Word joiner', pattern: /\u2060/g },
  { name: 'BOM', pattern: /\uFEFF/g },
  { name: 'Left-to-right mark', pattern: /\u200E/g },
  { name: 'Right-to-left mark', pattern: /\u200F/g },
];

zeroWidthPatterns.forEach(p => {
  const matches = systemMessage.match(p.pattern) || [];
  if (matches.length > 0) {
    console.log(p.name + ':', matches.length, 'occurrences');
  }
});

// Check for smart quotes or other typographic characters near braces
console.log('\n=== Checking for typographic characters near braces ===');
const braceContexts = [];
let idx = 0;
while ((idx = systemMessage.indexOf('{', idx)) !== -1) {
  const context = systemMessage.substring(Math.max(0, idx-3), idx+10);
  const hasTypo = /[''""–—…]/g.test(context);
  if (hasTypo) {
    braceContexts.push({ pos: idx, context });
  }
  idx++;
}
console.log('Braces near typographic chars:', braceContexts.length);
braceContexts.forEach(b => {
  console.log('  Position:', b.pos, 'Context:', JSON.stringify(b.context));
});

// Check for any escaped braces that might be problematic
console.log('\n=== Checking for escaped braces ===');
const escapedBraces = systemMessage.match(/\\[\{\}]/g) || [];
console.log('Escaped braces (\\{ or \\}):', escapedBraces.length);

// Check for triple braces (Mustache unescaped syntax)
console.log('\n=== Checking for triple braces ===');
const tripleBraces = systemMessage.match(/\{\{\{|\}\}\}/g) || [];
console.log('Triple braces:', tripleBraces.length);

// Show a character-by-character view of first few { contexts
console.log('\n=== Character codes around first 5 { characters ===');
let found = 0;
for (let i = 0; i < systemMessage.length && found < 5; i++) {
  if (systemMessage[i] === '{') {
    found++;
    console.log('\n' + found + '. Position', i + ':');
    for (let j = Math.max(0, i-3); j < Math.min(systemMessage.length, i+15); j++) {
      const c = systemMessage[j];
      const code = systemMessage.charCodeAt(j);
      const display = c === '\n' ? '\\n' : c === '\t' ? '\\t' : c;
      console.log('   [' + j + '] ' + code + ' = ' + JSON.stringify(display));
    }
  }
}
