#!/usr/bin/env node
/**
 * Update Prompt Version Script
 *
 * Updates a prompt/tool version in the test-agent database after making changes to V1 files.
 *
 * Usage:
 *   node scripts/update-prompt-version.js <fileKey> "<changeDescription>"
 *
 * File Keys:
 *   - nodered_flow     : Node Red Flows (nodered_Cloud9_flows.json)
 *   - scheduling_tool  : Scheduling Tool (schedule_appointment_dso_Tool.json)
 *   - patient_tool     : Patient Tool (chord_dso_patient_Tool.json)
 *   - system_prompt    : System Prompt (Chord_Cloud9_SystemPrompt.md)
 *
 * Examples:
 *   node scripts/update-prompt-version.js nodered_flow "Fix grouped_slots timeout"
 *   node scripts/update-prompt-version.js scheduling_tool "Enhanced tool description"
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../test-agent/data/test-results.db');
const V1_DIR = path.join(__dirname, '../docs/v1');

const FILE_MAPPINGS = {
  nodered_flow: {
    path: path.join(V1_DIR, 'nodered_Cloud9_flows.json'),
    displayName: 'Node Red Flows',
    extractFunc: false
  },
  scheduling_tool: {
    path: path.join(V1_DIR, 'schedule_appointment_dso_Tool.json'),
    displayName: 'Scheduling Tool',
    extractFunc: true,
    funcFile: 'scheduling_tool_func.js'
  },
  patient_tool: {
    path: path.join(V1_DIR, 'chord_dso_patient_Tool.json'),
    displayName: 'Patient Tool',
    extractFunc: true,
    funcFile: 'patient_tool_func.js'
  },
  system_prompt: {
    path: path.join(V1_DIR, 'Chord_Cloud9_SystemPrompt.md'),
    displayName: 'System Prompt',
    extractFunc: false
  }
};

function updateVersion(fileKey, changeDescription) {
  const mapping = FILE_MAPPINGS[fileKey];
  if (!mapping) {
    console.error(`Unknown file key: ${fileKey}`);
    console.error(`Valid keys: ${Object.keys(FILE_MAPPINGS).join(', ')}`);
    process.exit(1);
  }

  if (!fs.existsSync(mapping.path)) {
    console.error(`File not found: ${mapping.path}`);
    process.exit(1);
  }

  let content = fs.readFileSync(mapping.path, 'utf-8');

  // For tools, extract only the JavaScript func field
  if (mapping.extractFunc) {
    const json = JSON.parse(content);
    content = json.func;

    // Also write to separate .js file for easy copy/paste
    const funcPath = path.join(V1_DIR, mapping.funcFile);
    fs.writeFileSync(funcPath, content);
    console.log(`Extracted func -> ${mapping.funcFile} (${content.length} chars)`);
  }

  const db = new Database(DB_PATH, { readonly: false });
  const now = new Date().toISOString();

  try {
    // Get current version
    const current = db.prepare('SELECT version FROM prompt_working_copies WHERE file_key = ?').get(fileKey);
    const newVersion = (current?.version || 0) + 1;

    // Update working copy
    db.prepare('UPDATE prompt_working_copies SET content = ?, version = ?, updated_at = ? WHERE file_key = ?')
      .run(content, newVersion, now, fileKey);

    // Insert version history
    db.prepare('INSERT INTO prompt_version_history (file_key, version, content, fix_id, change_description, created_at) VALUES (?, ?, ?, NULL, ?, ?)')
      .run(fileKey, newVersion, content, changeDescription, now);

    console.log(`${mapping.displayName}: v${current?.version || 0} -> v${newVersion}`);
    console.log(`Change: ${changeDescription}`);
  } finally {
    db.close();
  }
}

// Main
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node scripts/update-prompt-version.js <fileKey> "<changeDescription>"');
  console.log('\nFile Keys:', Object.keys(FILE_MAPPINGS).join(', '));
  process.exit(1);
}

updateVersion(args[0], args[1]);
