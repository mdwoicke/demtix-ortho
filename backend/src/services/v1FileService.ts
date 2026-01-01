/**
 * V1 File Service
 * Centralized management of all V1 production files:
 * - System Prompt (Chord_Cloud9_SystemPrompt.md)
 * - Node Red Flows (nodered_Cloud9_flows.json)
 * - Patient Tool (chord_dso_patient_Tool.json)
 * - Scheduling Tool (schedule_appointment_dso_Tool.json)
 *
 * These files are the canonical source for:
 * - Flowise prompt configuration
 * - Node Red flow definitions
 * - Flowise tool definitions
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ============================================================================
// V1 FILE CONFIGURATION
// ============================================================================

/**
 * V1 File Types
 */
export type V1FileType = 'prompt' | 'flow' | 'tool';

/**
 * V1 File metadata
 */
export interface V1FileMeta {
  fileKey: string;
  fileName: string;
  displayName: string;
  fileType: V1FileType;
  v1Path: string;
  noderedPath: string | null;  // Copy in nodered directory for backward compatibility
  description: string;
}

/**
 * V1 directory paths
 */
const V1_DIR = path.resolve(__dirname, '../../../docs/v1');
const NODERED_DIR = path.resolve(__dirname, '../../../nodered');

/**
 * V1 File definitions
 */
export const V1_FILES: Record<string, V1FileMeta> = {
  system_prompt: {
    fileKey: 'system_prompt',
    fileName: 'Chord_Cloud9_SystemPrompt.md',
    displayName: 'System Prompt',
    fileType: 'prompt',
    v1Path: path.join(V1_DIR, 'Chord_Cloud9_SystemPrompt.md'),
    noderedPath: null,
    description: 'Advanced IVA system prompt for Allie scheduling assistant',
  },
  nodered_flow: {
    fileKey: 'nodered_flow',
    fileName: 'nodered_Cloud9_flows.json',
    displayName: 'Node Red Flows',
    fileType: 'flow',
    v1Path: path.join(V1_DIR, 'nodered_Cloud9_flows.json'),
    noderedPath: path.join(NODERED_DIR, 'nodered_Cloud9_flows.json'),
    description: 'Node Red flow definitions for Cloud9 API integration',
  },
  patient_tool: {
    fileKey: 'patient_tool',
    fileName: 'chord_dso_patient_Tool.json',
    displayName: 'Patient Tool',
    fileType: 'tool',
    v1Path: path.join(V1_DIR, 'chord_dso_patient_Tool.json'),
    noderedPath: path.join(NODERED_DIR, 'chord_dso_patient_Tool.json'),
    description: 'Flowise tool for patient operations (lookup, create, appointments)',
  },
  scheduling_tool: {
    fileKey: 'scheduling_tool',
    fileName: 'schedule_appointment_dso_Tool.json',
    displayName: 'Scheduling Tool',
    fileType: 'tool',
    v1Path: path.join(V1_DIR, 'schedule_appointment_dso_Tool.json'),
    noderedPath: path.join(NODERED_DIR, 'schedule_appointment_dso_Tool.json'),
    description: 'Flowise tool for appointment scheduling operations',
  },
};

// ============================================================================
// FILE STATUS TYPES
// ============================================================================

export interface V1FileStatus {
  fileKey: string;
  displayName: string;
  fileType: V1FileType;
  exists: boolean;
  size: number;
  hash: string | null;
  modifiedAt: string | null;
  valid: boolean;
  validationErrors: string[];
  syncedToNodered: boolean;
}

export interface V1FilesStatus {
  allValid: boolean;
  files: V1FileStatus[];
  checkedAt: string;
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Calculate MD5 hash of file content
 */
function calculateHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Read a V1 file
 */
export function readV1File(fileKey: string): { content: string; meta: V1FileMeta } | null {
  const meta = V1_FILES[fileKey];
  if (!meta) {
    return null;
  }

  if (!fs.existsSync(meta.v1Path)) {
    return null;
  }

  const content = fs.readFileSync(meta.v1Path, 'utf-8');
  return { content, meta };
}

/**
 * Write a V1 file (updates both V1 and nodered copy)
 */
export function writeV1File(fileKey: string, content: string): { success: boolean; error?: string } {
  const meta = V1_FILES[fileKey];
  if (!meta) {
    return { success: false, error: `Unknown file key: ${fileKey}` };
  }

  // Validate content before writing
  const validation = validateV1FileContent(fileKey, content);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  try {
    // Write to V1 directory
    fs.writeFileSync(meta.v1Path, content, 'utf-8');

    // Also update nodered copy if applicable
    if (meta.noderedPath) {
      fs.writeFileSync(meta.noderedPath, content, 'utf-8');
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Sync V1 file to nodered directory
 */
export function syncToNodered(fileKey: string): { success: boolean; error?: string } {
  const meta = V1_FILES[fileKey];
  if (!meta) {
    return { success: false, error: `Unknown file key: ${fileKey}` };
  }

  if (!meta.noderedPath) {
    return { success: true };  // No nodered copy needed
  }

  try {
    const content = fs.readFileSync(meta.v1Path, 'utf-8');
    fs.writeFileSync(meta.noderedPath, content, 'utf-8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate V1 file content based on file type
 */
export function validateV1FileContent(
  fileKey: string,
  content: string
): { valid: boolean; errors: string[]; warnings: string[] } {
  const meta = V1_FILES[fileKey];
  if (!meta) {
    return { valid: false, errors: [`Unknown file key: ${fileKey}`], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic checks
  if (!content || content.trim().length === 0) {
    errors.push('Content is empty');
    return { valid: false, errors, warnings };
  }

  // Type-specific validation
  switch (meta.fileType) {
    case 'prompt':
      return validatePromptContent(content);
    case 'flow':
      return validateFlowContent(content);
    case 'tool':
      return validateToolContent(content);
    default:
      return { valid: true, errors: [], warnings: [] };
  }
}

/**
 * Validate prompt markdown content
 */
function validatePromptContent(content: string): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required sections
  const requiredPatterns = [
    { pattern: /# .*Identity/i, name: 'Identity section' },
    { pattern: /# .*State/i, name: 'State Machine section' },
  ];

  for (const { pattern, name } of requiredPatterns) {
    if (!pattern.test(content)) {
      warnings.push(`Missing recommended ${name}`);
    }
  }

  // Check for minimum length
  if (content.length < 1000) {
    warnings.push('Prompt content seems short (less than 1000 characters)');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate Node Red flow JSON
 */
function validateFlowContent(content: string): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const flow = JSON.parse(content);

    // Check if it's an array (Node Red format)
    if (!Array.isArray(flow)) {
      errors.push('Node Red flow must be a JSON array');
      return { valid: false, errors, warnings };
    }

    // Check for required node types
    const nodeTypes = new Set(flow.map((n: any) => n.type));

    if (!nodeTypes.has('tab')) {
      warnings.push('Flow does not contain a tab node');
    }

    // Count HTTP nodes
    const httpInCount = flow.filter((n: any) => n.type === 'http in').length;
    const httpOutCount = flow.filter((n: any) => n.type === 'http response').length;

    if (httpInCount === 0) {
      warnings.push('No HTTP In nodes found - flow may not expose any endpoints');
    }

    if (httpInCount !== httpOutCount) {
      warnings.push(`HTTP In (${httpInCount}) and Response (${httpOutCount}) count mismatch`);
    }

    // Check for environment variables
    const hasEnvVars = flow.some((n: any) =>
      n.type === 'tab' && n.env && n.env.length > 0
    );

    if (!hasEnvVars) {
      warnings.push('No environment variables configured in flow');
    }

  } catch (error: any) {
    errors.push(`Invalid JSON: ${error.message}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate Flowise tool JSON
 */
function validateToolContent(content: string): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const tool = JSON.parse(content);

    // Check for required fields
    const requiredFields = ['name', 'description', 'schema', 'func'];
    for (const field of requiredFields) {
      if (!tool[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate schema structure
    if (tool.schema) {
      if (!tool.schema.type || tool.schema.type !== 'object') {
        warnings.push('Schema should have type "object"');
      }
      if (!tool.schema.properties) {
        errors.push('Schema missing properties definition');
      }
      if (!tool.schema.required || !Array.isArray(tool.schema.required)) {
        warnings.push('Schema should have required array');
      }
    }

    // Check function content
    if (tool.func) {
      if (!tool.func.includes('async function')) {
        warnings.push('Function should use async pattern');
      }
      if (!tool.func.includes('return')) {
        warnings.push('Function should have a return statement');
      }
    }

  } catch (error: any) {
    errors.push(`Invalid JSON: ${error.message}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
// STATUS & HEALTH CHECK
// ============================================================================

/**
 * Get status of a single V1 file
 */
export function getV1FileStatus(fileKey: string): V1FileStatus | null {
  const meta = V1_FILES[fileKey];
  if (!meta) {
    return null;
  }

  const exists = fs.existsSync(meta.v1Path);
  let size = 0;
  let hash: string | null = null;
  let modifiedAt: string | null = null;
  let valid = false;
  let validationErrors: string[] = [];
  let syncedToNodered = true;

  if (exists) {
    try {
      const stats = fs.statSync(meta.v1Path);
      size = stats.size;
      modifiedAt = stats.mtime.toISOString();

      const content = fs.readFileSync(meta.v1Path, 'utf-8');
      hash = calculateHash(content);

      const validation = validateV1FileContent(fileKey, content);
      valid = validation.valid;
      validationErrors = validation.errors;

      // Check if synced to nodered
      if (meta.noderedPath) {
        if (fs.existsSync(meta.noderedPath)) {
          const noderedContent = fs.readFileSync(meta.noderedPath, 'utf-8');
          syncedToNodered = calculateHash(noderedContent) === hash;
        } else {
          syncedToNodered = false;
        }
      }
    } catch (error: any) {
      valid = false;
      validationErrors = [error.message];
    }
  }

  return {
    fileKey: meta.fileKey,
    displayName: meta.displayName,
    fileType: meta.fileType,
    exists,
    size,
    hash,
    modifiedAt,
    valid,
    validationErrors,
    syncedToNodered,
  };
}

/**
 * Get status of all V1 files
 */
export function getAllV1FilesStatus(): V1FilesStatus {
  const files: V1FileStatus[] = [];
  let allValid = true;

  for (const fileKey of Object.keys(V1_FILES)) {
    const status = getV1FileStatus(fileKey);
    if (status) {
      files.push(status);
      if (!status.valid || !status.exists) {
        allValid = false;
      }
    }
  }

  return {
    allValid,
    files,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Sync all V1 files to nodered directory
 */
export function syncAllToNodered(): { success: boolean; results: Record<string, boolean> } {
  const results: Record<string, boolean> = {};
  let allSuccess = true;

  for (const fileKey of Object.keys(V1_FILES)) {
    const result = syncToNodered(fileKey);
    results[fileKey] = result.success;
    if (!result.success) {
      allSuccess = false;
    }
  }

  return { success: allSuccess, results };
}

// ============================================================================
// LIST AND GET ALL
// ============================================================================

/**
 * Get list of all V1 file metadata
 */
export function listV1Files(): V1FileMeta[] {
  return Object.values(V1_FILES);
}

/**
 * Read all V1 files
 */
export function readAllV1Files(): Record<string, { content: string; meta: V1FileMeta } | null> {
  const result: Record<string, { content: string; meta: V1FileMeta } | null> = {};

  for (const fileKey of Object.keys(V1_FILES)) {
    result[fileKey] = readV1File(fileKey);
  }

  return result;
}
