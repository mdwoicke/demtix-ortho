/**
 * Script to escape all curly braces in the Flowise chatflow systemMessage
 * for Mustache template compatibility.
 *
 * Flowise uses Mustache where {{ }} is template syntax, so all literal
 * braces must be doubled: { → {{ and } → }}
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'Ortho_Chatflow_latest.json');
const outputFile = path.join(__dirname, 'Ortho_Chatflow_latest.json'); // Overwrite

/**
 * Escape curly braces for Flowise Mustache template compatibility.
 * Converts { → {{ and } → }} (unless already escaped)
 */
function escapeForFlowise(content) {
  if (!content) return content;

  const replacements = [];

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1] || '';
    const prevChar = content[i - 1] || '';

    if (char === '{') {
      // Check if already escaped (part of {{ )
      if (nextChar !== '{' && prevChar !== '{') {
        replacements.push({ index: i, from: '{', to: '{{' });
      } else if (nextChar === '{') {
        // Skip the next brace as it's part of {{
        i++;
      }
    } else if (char === '}') {
      // Check if already escaped (part of }} )
      if (nextChar !== '}' && prevChar !== '}') {
        replacements.push({ index: i, from: '}', to: '}}' });
      } else if (nextChar === '}') {
        // Skip the next brace as it's part of }}
        i++;
      }
    }
  }

  // Apply replacements in reverse order to maintain correct indices
  let result = content;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { index, from, to } = replacements[i];
    result = result.substring(0, index) + to + result.substring(index + from.length);
  }

  return result;
}

/**
 * Count unescaped braces for verification
 */
function countUnescapedBraces(content) {
  let count = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1] || '';
    const prevChar = content[i - 1] || '';

    if (char === '{' && nextChar !== '{' && prevChar !== '{') {
      count++;
    } else if (char === '}' && nextChar !== '}' && prevChar !== '}') {
      count++;
    }
  }
  return count;
}

// Read the chatflow JSON
console.log('Reading', inputFile, '...');
const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// Find the toolAgent node
const toolAgent = data.nodes.find(n => n.id === 'toolAgent_0');
if (!toolAgent) {
  console.error('ERROR: toolAgent_0 node not found!');
  process.exit(1);
}

const originalMessage = toolAgent.data.inputs.systemMessage;
console.log('\n=== Original systemMessage ===');
console.log('Length:', originalMessage.length, 'chars');
console.log('Unescaped braces before:', countUnescapedBraces(originalMessage));

// Escape the braces
const escapedMessage = escapeForFlowise(originalMessage);
console.log('\n=== Escaped systemMessage ===');
console.log('Length:', escapedMessage.length, 'chars');
console.log('Unescaped braces after:', countUnescapedBraces(escapedMessage));

// Update the node
toolAgent.data.inputs.systemMessage = escapedMessage;

// Save back to file
console.log('\n=== Saving to', outputFile, '===');
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf8');
console.log('Done! Chatflow has been updated with escaped braces.');

// Show a sample of the changes
console.log('\n=== Sample of escaped content (first JSON block) ===');
const jsonBlockMatch = escapedMessage.match(/\{\{[\s\S]*?\}\}/);
if (jsonBlockMatch) {
  console.log(jsonBlockMatch[0].substring(0, 500));
}
