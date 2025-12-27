/**
 * Script to add the escaped system prompt as a new version in the database
 */

const fs = require('fs');
const path = require('path');

// Require better-sqlite3 from backend node_modules
const backendNodeModules = path.join(__dirname, '../backend/node_modules/better-sqlite3');
const BetterSqlite3 = require(backendNodeModules);

const CHATFLOW_PATH = path.join(__dirname, 'Ortho_Chatflow_latest.json');
const DB_PATH = path.join(__dirname, '../test-agent/data/test-results.db');

console.log('=== Adding Escaped System Prompt Version ===\n');

// Read the escaped content from the chatflow
console.log('Reading chatflow from:', CHATFLOW_PATH);
const chatflow = JSON.parse(fs.readFileSync(CHATFLOW_PATH, 'utf8'));

const toolAgent = chatflow.nodes.find(n => n.id === 'toolAgent_0');
if (!toolAgent) {
  console.error('ERROR: toolAgent_0 not found in chatflow');
  process.exit(1);
}

const escapedContent = toolAgent.data.inputs.systemMessage;
console.log('Escaped content length:', escapedContent.length, 'chars');

// Check for unescaped braces
let unescapedCount = 0;
for (let i = 0; i < escapedContent.length; i++) {
  const char = escapedContent[i];
  const nextChar = escapedContent[i + 1] || '';
  const prevChar = escapedContent[i - 1] || '';

  if (char === '{' && nextChar !== '{' && prevChar !== '{') {
    unescapedCount++;
  } else if (char === '}' && nextChar !== '}' && prevChar !== '}') {
    unescapedCount++;
  }
}
console.log('Unescaped braces:', unescapedCount);

if (unescapedCount > 0) {
  console.warn('WARNING: Content still has unescaped braces!');
}

// Connect to database
console.log('\nConnecting to database:', DB_PATH);
const db = new BetterSqlite3(DB_PATH, { readonly: false });

try {
  // Get current version
  const current = db.prepare(`
    SELECT content, version FROM prompt_working_copies WHERE file_key = ?
  `).get('system_prompt');

  if (!current) {
    console.error('ERROR: system_prompt not found in database');
    process.exit(1);
  }

  console.log('Current version:', current.version);

  const newVersion = current.version + 1;
  const now = new Date().toISOString();
  const changeDescription = 'Escaped all curly braces for Flowise Mustache compatibility';

  // Update working copy
  db.prepare(`
    UPDATE prompt_working_copies
    SET content = ?, version = ?, updated_at = ?
    WHERE file_key = ?
  `).run(escapedContent, newVersion, now, 'system_prompt');

  // Create version history entry
  db.prepare(`
    INSERT INTO prompt_version_history (file_key, version, content, fix_id, change_description, created_at)
    VALUES (?, ?, ?, NULL, ?, ?)
  `).run('system_prompt', newVersion, escapedContent, changeDescription, now);

  console.log('\n=== SUCCESS ===');
  console.log('New version:', newVersion);
  console.log('Change:', changeDescription);
  console.log('Timestamp:', now);

} finally {
  db.close();
}

// Also update the markdown file
const markdownPath = path.join(__dirname, 'Chord_Cloud9_SystemPrompt.md');
console.log('\nUpdating markdown file:', markdownPath);
fs.writeFileSync(markdownPath, escapedContent, 'utf8');
console.log('Markdown file updated.');
