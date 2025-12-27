const fs = require('fs');
const data = JSON.parse(fs.readFileSync('Ortho_Chatflow_latest.json', 'utf8'));

const toolAgent = data.nodes.find(n => n.id === 'toolAgent_0');
const systemMessage = toolAgent.data.inputs.systemMessage;

console.log('=== SystemMessage Analysis ===');
console.log('Total length:', systemMessage.length);

// Look for {{ patterns (Flowise variables)
console.log('\n=== Double-brace patterns {{...}} ===');
const doubleBrace = systemMessage.match(/\{\{[^}]+\}\}/g) || [];
console.log('Found:', doubleBrace.length);
doubleBrace.forEach(p => console.log('  ', p));

// Look for {text} where text is a simple identifier
console.log('\n=== Simple variable patterns {identifier} ===');
const simpleVarPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
let simpleVars = [];
let m;
while ((m = simpleVarPattern.exec(systemMessage)) !== null) {
  const start = Math.max(0, m.index - 30);
  const end = Math.min(systemMessage.length, m.index + m[0].length + 30);
  const context = systemMessage.substring(start, end).replace(/\n/g, '\\n');
  simpleVars.push({ full: m[0], name: m[1], pos: m.index, context });
}
console.log('Count:', simpleVars.length);
simpleVars.forEach(v => {
  console.log('  Pattern:', v.full);
  console.log('  Position:', v.pos);
  console.log('  Context:', v.context);
  console.log('');
});

// Look for patterns like {input} which is mentioned in the node description
console.log('\n=== Searching for {input} specifically ===');
const inputPattern = systemMessage.indexOf('{input}');
if (inputPattern >= 0) {
  console.log('Found {input} at position:', inputPattern);
  console.log('Context:', systemMessage.substring(inputPattern - 50, inputPattern + 60));
}

// Look for unescaped single braces that could cause issues
console.log('\n=== All { positions with surrounding context ===');
let bracePositions = [];
for (let i = 0; i < systemMessage.length; i++) {
  if (systemMessage[i] === '{') {
    // Check if it's not {{ (double brace)
    if (systemMessage[i + 1] !== '{') {
      const context = systemMessage.substring(Math.max(0, i - 10), Math.min(systemMessage.length, i + 40)).replace(/\n/g, '\\n');
      bracePositions.push({ pos: i, context });
    }
  }
}
console.log('Single { count:', bracePositions.length);
console.log('\nFirst 20 single { patterns:');
bracePositions.slice(0, 20).forEach((b, idx) => {
  console.log(idx + 1 + '. pos', b.pos + ':', b.context);
});

// Look specifically for patterns that match Mustache variable syntax
console.log('\n=== Mustache-like patterns (not JSON) ===');
// Match {word} where word is alphanumeric, not followed by colon (JSON key pattern)
const mustacheLike = [];
const mustacheRegex = /\{([a-zA-Z_$][a-zA-Z0-9_$.-]*)\}(?!\s*:)/g;
while ((m = mustacheRegex.exec(systemMessage)) !== null) {
  const context = systemMessage.substring(Math.max(0, m.index - 20), Math.min(systemMessage.length, m.index + m[0].length + 20)).replace(/\n/g, '\\n');
  mustacheLike.push({ pattern: m[0], inner: m[1], pos: m.index, context });
}
console.log('Found:', mustacheLike.length);
mustacheLike.forEach((p, i) => {
  console.log((i + 1) + '. ' + p.pattern + ' at ' + p.pos);
  console.log('   Context: ' + p.context);
});
