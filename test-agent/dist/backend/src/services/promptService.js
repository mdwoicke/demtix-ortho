"use strict";
/**
 * Prompt Service
 * Manages prompt working copies, versioning, and fix application
 *
 * IMPORTANT: All fixes are validated before saving to prevent broken code.
 * - JavaScript files are syntax-checked using vm.compileFunction
 * - Brace matching is validated for all files
 * - Invalid merges are rejected with detailed error messages
 *
 * FLOWISE COMPATIBILITY:
 * - Flowise uses Mustache templating where {{...}} is the template syntax
 * - All literal curly braces in prompt content must be escaped as {{ and }}
 * - The escapeForFlowise() function handles this automatically
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeForFlowise = escapeForFlowise;
exports.unescapeFromFlowise = unescapeFromFlowise;
exports.detectUnescapedBraces = detectUnescapedBraces;
exports.initializeWorkingCopies = initializeWorkingCopies;
exports.getPromptFiles = getPromptFiles;
exports.getPromptContent = getPromptContent;
exports.getPromptHistory = getPromptHistory;
exports.applyFix = applyFix;
exports.getVersionContent = getVersionContent;
exports.syncToDisk = syncToDisk;
exports.saveNewVersion = saveNewVersion;
exports.applyBatchFixes = applyBatchFixes;
exports.resetFromDisk = resetFromDisk;
exports.getDeployedVersions = getDeployedVersions;
exports.markAsDeployed = markAsDeployed;
exports.getDeploymentHistory = getDeploymentHistory;
exports.rollbackToVersion = rollbackToVersion;
exports.getVersionDiff = getVersionDiff;
exports.getCachedQualityScore = getCachedQualityScore;
exports.saveQualityScoreToCache = saveQualityScoreToCache;
exports.clearQualityScoreCache = clearQualityScoreCache;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const vm_1 = __importDefault(require("vm"));
// ============================================================================
// FLOWISE BRACE ESCAPING
// ============================================================================
/**
 * Escape curly braces for Flowise Mustache template compatibility.
 *
 * Flowise uses Mustache templating where:
 * - {{variable}} is used for variable substitution
 * - Single { or } in content causes "Single '}' in template" errors
 *
 * This function converts:
 * - { → {{ (unless already escaped)
 * - } → }} (unless already escaped)
 *
 * @param content - The raw prompt content
 * @returns Content with braces escaped for Flowise
 */
function escapeForFlowise(content) {
    if (!content)
        return content;
    // Track positions to escape (we need to process in reverse to maintain indices)
    const replacements = [];
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1] || '';
        const prevChar = content[i - 1] || '';
        if (char === '{') {
            // Check if already escaped (part of {{ )
            if (nextChar !== '{' && prevChar !== '{') {
                replacements.push({ index: i, from: '{', to: '{{' });
            }
            else if (nextChar === '{') {
                // Skip the next brace as it's part of {{
                i++;
            }
        }
        else if (char === '}') {
            // Check if already escaped (part of }} )
            if (nextChar !== '}' && prevChar !== '}') {
                replacements.push({ index: i, from: '}', to: '}}' });
            }
            else if (nextChar === '}') {
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
 * Unescape curly braces from Flowise format back to normal.
 *
 * This function converts:
 * - {{ → {
 * - }} → }
 *
 * @param content - The Flowise-escaped content
 * @returns Content with braces unescaped
 */
function unescapeFromFlowise(content) {
    if (!content)
        return content;
    // Simple replacement - {{ becomes {, }} becomes }
    return content.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
}
/**
 * Detect if content has unescaped braces that would cause Flowise errors.
 *
 * @param content - The content to check
 * @returns Object with detection results
 */
function detectUnescapedBraces(content) {
    const positions = [];
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1] || '';
        const prevChar = content[i - 1] || '';
        if (char === '{' && nextChar !== '{' && prevChar !== '{') {
            const start = Math.max(0, i - 15);
            const end = Math.min(content.length, i + 25);
            const context = content.substring(start, end).replace(/\n/g, '\\n');
            positions.push({ index: i, char: '{', context });
        }
        else if (char === '}' && nextChar !== '}' && prevChar !== '}') {
            const start = Math.max(0, i - 15);
            const end = Math.min(content.length, i + 25);
            const context = content.substring(start, end).replace(/\n/g, '\\n');
            positions.push({ index: i, char: '}', context });
        }
    }
    return {
        hasUnescaped: positions.length > 0,
        count: positions.length,
        positions,
    };
}
// Path to test-agent database
const TEST_AGENT_DB_PATH = path_1.default.resolve(__dirname, '../../../test-agent/data/test-results.db');
// Prompt file mappings
const PROMPT_FILE_MAPPINGS = {
    system_prompt: {
        path: path_1.default.resolve(__dirname, '../../../docs/Chord_Cloud9_SystemPrompt_V3_ADVANCED.md'),
        displayName: 'System Prompt',
    },
    scheduling_tool: {
        path: path_1.default.resolve(__dirname, '../../../docs/chord_dso_scheduling-V3-ENHANCED.js'),
        displayName: 'Scheduling Tool',
    },
    patient_tool: {
        path: path_1.default.resolve(__dirname, '../../../docs/chord_dso_patient-V3-ENHANCED.js'),
        displayName: 'Patient Tool',
    },
};
/**
 * Validate content based on file type
 */
function validateContent(content, fileKey) {
    const errors = [];
    const warnings = [];
    // Check for basic issues
    if (!content || content.trim().length === 0) {
        errors.push('Content is empty');
        return { valid: false, errors, warnings };
    }
    // Determine if this is a JavaScript file
    const isJavaScriptFile = fileKey.includes('tool') || fileKey.endsWith('.js');
    // For JS files, validate syntax using vm.compileFunction (comprehensive validation)
    // Skip simple brace validation for JS files - vm.compileFunction handles this better
    if (isJavaScriptFile) {
        const jsValidation = validateJavaScriptSyntax(content);
        if (!jsValidation.valid) {
            errors.push(...jsValidation.errors);
        }
        warnings.push(...jsValidation.warnings);
    }
    else {
        // For non-JS files (prompts, markdown), validate braces are balanced
        const braceValidation = validateBraces(content);
        if (!braceValidation.valid) {
            errors.push(...braceValidation.errors);
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * Validate that braces are balanced in the content
 */
function validateBraces(content) {
    const errors = [];
    const warnings = [];
    // Track brace positions for better error messages
    const stack = [];
    const lines = content.split('\n');
    const pairs = { '{': '}', '[': ']', '(': ')' };
    const closers = { '}': '{', ']': '[', ')': '(' };
    let inString = false;
    let stringChar = '';
    let inLineComment = false;
    let inBlockComment = false;
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        inLineComment = false;
        for (let col = 0; col < line.length; col++) {
            const char = line[col];
            const prevChar = col > 0 ? line[col - 1] : '';
            const nextChar = col < line.length - 1 ? line[col + 1] : '';
            // Handle comments
            if (!inString && !inBlockComment && char === '/' && nextChar === '/') {
                inLineComment = true;
                break;
            }
            if (!inString && !inBlockComment && char === '/' && nextChar === '*') {
                inBlockComment = true;
                col++;
                continue;
            }
            if (inBlockComment && char === '*' && nextChar === '/') {
                inBlockComment = false;
                col++;
                continue;
            }
            if (inLineComment || inBlockComment)
                continue;
            // Handle strings
            if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                }
                else if (char === stringChar) {
                    inString = false;
                }
                continue;
            }
            if (inString)
                continue;
            // Track braces
            if (pairs[char]) {
                stack.push({ char, line: lineNum + 1, col: col + 1 });
            }
            else if (closers[char]) {
                const expected = closers[char];
                if (stack.length === 0) {
                    errors.push(`Unexpected '${char}' at line ${lineNum + 1}, col ${col + 1} - no matching opener`);
                }
                else if (stack[stack.length - 1].char !== expected) {
                    const top = stack[stack.length - 1];
                    errors.push(`Mismatched brace: expected '${pairs[top.char]}' to close '${top.char}' from line ${top.line}, but found '${char}' at line ${lineNum + 1}`);
                }
                else {
                    stack.pop();
                }
            }
        }
    }
    // Check for unclosed braces
    for (const unclosed of stack) {
        errors.push(`Unclosed '${unclosed.char}' at line ${unclosed.line}, col ${unclosed.col}`);
    }
    return { valid: errors.length === 0, errors, warnings };
}
/**
 * Validate JavaScript syntax using vm.compileFunction
 *
 * BULLETPROOF VALIDATION:
 * This function performs comprehensive validation to prevent broken code
 * from being saved. The v2/v3 scheduling tool incident showed that partial
 * or malformed code can slip through - we now check:
 * 1. JavaScript syntax (vm.compileFunction)
 * 2. Required structural patterns (executeRequest, return statement)
 * 3. Undefined variable references (cleanedParams -> params)
 * 4. Proper ending (truncation detection)
 */
function validateJavaScriptSyntax(content) {
    const errors = [];
    const warnings = [];
    // =========================================================================
    // STEP 1: Syntax validation using vm.compileFunction
    // =========================================================================
    try {
        // Wrap in an async function to support await and return statements
        const wrappedCode = `(async function() {\n${content}\n})`;
        vm_1.default.compileFunction(wrappedCode, [], { filename: 'validation.js' });
    }
    catch (error) {
        // Extract line number from error if possible
        const lineMatch = error.message?.match(/line (\d+)/i);
        const line = lineMatch ? parseInt(lineMatch[1]) - 1 : 'unknown'; // -1 for wrapper
        errors.push(`JavaScript syntax error at line ${line}: ${error.message}`);
    }
    // =========================================================================
    // STEP 2: Structural validation - check required patterns
    // =========================================================================
    // Check for required function declaration
    if (!content.includes('async function executeRequest()')) {
        errors.push('Missing required "async function executeRequest()" declaration');
    }
    // Check for proper ending - must end with "return executeRequest();"
    // This catches truncated files (like v3 which was cut off mid-code)
    const trimmed = content.trim();
    if (!trimmed.endsWith('return executeRequest();')) {
        errors.push('Code must end with "return executeRequest();". ' +
            'File appears to be truncated or malformed.');
    }
    // Check for action variable (required for tool dispatch)
    if (!content.includes('const action = $action')) {
        errors.push('Missing required "const action = $action" declaration');
    }
    // =========================================================================
    // STEP 3: Undefined variable detection - CRITICAL FIX for cleanedParams bug
    // =========================================================================
    // The v2/v3 bug was caused by referencing 'cleanedParams' which doesn't exist.
    // This is now an ERROR, not a warning.
    if (content.includes('cleanedParams') && !content.includes('const cleanedParams') && !content.includes('let cleanedParams')) {
        errors.push('Reference to undefined "cleanedParams" variable. ' +
            'Did you mean "params"? This variable is never declared.');
    }
    // =========================================================================
    // STEP 4: Case block validation - check for duplicate cases
    // =========================================================================
    const caseBlocks = content.match(/case\s+'[^']+'\s*:/g) || [];
    const caseSet = new Set();
    for (const caseBlock of caseBlocks) {
        const caseName = caseBlock.match(/case\s+'([^']+)'/)?.[1];
        if (caseName) {
            if (caseSet.has(caseName)) {
                errors.push(`Duplicate case block found: 'case "${caseName}"'`);
            }
            caseSet.add(caseName);
        }
    }
    // =========================================================================
    // STEP 5: Additional safety warnings
    // =========================================================================
    // Warn about potential issues that aren't fatal
    if (content.includes('// TODO') || content.includes('// FIXME')) {
        warnings.push('Code contains TODO/FIXME comments - may be incomplete');
    }
    return { valid: errors.length === 0, errors, warnings };
}
/**
 * Get writable database connection
 */
function getWritableDb() {
    return new better_sqlite3_1.default(TEST_AGENT_DB_PATH, { readonly: false });
}
/**
 * Get read-only database connection
 */
function getReadOnlyDb() {
    return new better_sqlite3_1.default(TEST_AGENT_DB_PATH, { readonly: true });
}
/**
 * Get the next version number for a prompt file
 *
 * IMPORTANT: Always use this function to get the next version number.
 * This ensures version numbers are unique by checking the MAX version
 * in the history table, not just the working copy version.
 *
 * @param db - Database connection (must be already open)
 * @param fileKey - The file key to get next version for
 * @returns The next sequential version number
 */
function getNextVersion(db, fileKey) {
    // Get max version from history table (most reliable source)
    const historyMax = db.prepare(`
    SELECT MAX(version) as maxVersion FROM prompt_version_history WHERE file_key = ?
  `).get(fileKey);
    // Get current working copy version as fallback
    const workingCopy = db.prepare(`
    SELECT version FROM prompt_working_copies WHERE file_key = ?
  `).get(fileKey);
    // Use the highest of: history max, working copy version, or 0
    const maxFromHistory = historyMax?.maxVersion || 0;
    const maxFromWorkingCopy = workingCopy?.version || 0;
    const maxVersion = Math.max(maxFromHistory, maxFromWorkingCopy);
    return maxVersion + 1;
}
/**
 * Initialize working copies from disk files if they don't exist
 */
function initializeWorkingCopies() {
    const db = getWritableDb();
    try {
        for (const [fileKey, mapping] of Object.entries(PROMPT_FILE_MAPPINGS)) {
            // Check if working copy already exists
            const existing = db.prepare('SELECT id FROM prompt_working_copies WHERE file_key = ?').get(fileKey);
            if (!existing) {
                // Read from disk and create initial working copy
                if (fs_1.default.existsSync(mapping.path)) {
                    const content = fs_1.default.readFileSync(mapping.path, 'utf-8');
                    const now = new Date().toISOString();
                    // Create working copy
                    db.prepare(`
            INSERT INTO prompt_working_copies (file_key, file_path, display_name, content, version, updated_at)
            VALUES (?, ?, ?, ?, 1, ?)
          `).run(fileKey, mapping.path, mapping.displayName, content, now);
                    // Create initial version history entry
                    db.prepare(`
            INSERT INTO prompt_version_history (file_key, version, content, change_description, created_at)
            VALUES (?, 1, ?, 'Initial version from disk', ?)
          `).run(fileKey, content, now);
                }
            }
        }
    }
    finally {
        db.close();
    }
}
/**
 * Get all prompt files with their current version info
 */
function getPromptFiles() {
    // Ensure working copies are initialized
    initializeWorkingCopies();
    const db = getReadOnlyDb();
    try {
        const rows = db.prepare(`
      SELECT file_key, file_path, version, last_fix_id, updated_at
      FROM prompt_working_copies
      ORDER BY file_key
    `).all();
        return rows.map(row => ({
            fileKey: row.file_key,
            filePath: row.file_path,
            displayName: PROMPT_FILE_MAPPINGS[row.file_key]?.displayName || row.file_key,
            version: row.version,
            lastFixId: row.last_fix_id,
            updatedAt: row.updated_at,
        }));
    }
    finally {
        db.close();
    }
}
/**
 * Get current content for a specific prompt file
 */
function getPromptContent(fileKey) {
    // Ensure working copies are initialized
    initializeWorkingCopies();
    const db = getReadOnlyDb();
    try {
        const row = db.prepare(`
      SELECT content, version FROM prompt_working_copies WHERE file_key = ?
    `).get(fileKey);
        if (!row) {
            return null;
        }
        return {
            content: row.content,
            version: row.version,
        };
    }
    finally {
        db.close();
    }
}
/**
 * Get version history for a prompt file
 */
function getPromptHistory(fileKey, limit = 20) {
    const db = getReadOnlyDb();
    try {
        const rows = db.prepare(`
      SELECT id, file_key, version, content, fix_id, change_description, created_at
      FROM prompt_version_history
      WHERE file_key = ?
      ORDER BY version DESC
      LIMIT ?
    `).all(fileKey, limit);
        return rows.map(row => ({
            id: row.id,
            fileKey: row.file_key,
            version: row.version,
            content: row.content,
            fixId: row.fix_id,
            changeDescription: row.change_description,
            createdAt: row.created_at,
        }));
    }
    finally {
        db.close();
    }
}
/**
 * Apply a fix to a prompt and create a new version
 *
 * IMPORTANT: This function validates the merged content BEFORE saving.
 * If validation fails, the fix is NOT applied and an error is thrown.
 */
function applyFix(fileKey, fixId) {
    // Ensure working copies are initialized
    initializeWorkingCopies();
    const db = getWritableDb();
    try {
        // Get current working copy
        const current = db.prepare(`
      SELECT content, version FROM prompt_working_copies WHERE file_key = ?
    `).get(fileKey);
        if (!current) {
            throw new Error(`Prompt file not found: ${fileKey}`);
        }
        // Get the fix details
        const fix = db.prepare(`
      SELECT fix_id, type, target_file, change_description, change_code, location_json
      FROM generated_fixes
      WHERE fix_id = ?
    `).get(fixId);
        if (!fix) {
            throw new Error(`Fix not found: ${fixId}`);
        }
        // Parse location if present
        const location = fix.location_json ? JSON.parse(fix.location_json) : null;
        // Attempt to merge the fix into the current content
        let mergedContent;
        try {
            mergedContent = mergeFixIntoContent(current.content, {
                fixId: fix.fix_id,
                type: fix.type,
                targetFile: fix.target_file,
                changeDescription: fix.change_description,
                changeCode: fix.change_code,
                location,
            });
        }
        catch (mergeError) {
            throw new Error(`Failed to merge fix: ${mergeError.message}`);
        }
        // CRITICAL: Validate the merged content before saving
        const validation = validateContent(mergedContent, fileKey);
        if (!validation.valid) {
            // Log the validation errors for debugging
            console.error(`[promptService] Fix validation failed for ${fileKey}:`);
            validation.errors.forEach(err => console.error(`  - ${err}`));
            throw new Error(`Fix would create invalid content. Errors:\n${validation.errors.join('\n')}\n\n` +
                `The fix was NOT applied. Please review the fix code and try again.`);
        }
        // Log any warnings
        if (validation.warnings.length > 0) {
            console.warn(`[promptService] Fix applied with warnings for ${fileKey}:`);
            validation.warnings.forEach(warn => console.warn(`  - ${warn}`));
        }
        // Escape curly braces for Flowise compatibility (only for non-JS files like system_prompt)
        const isJavaScriptFile = fileKey.includes('tool') || fileKey.endsWith('.js');
        const contentToSave = !isJavaScriptFile ? escapeForFlowise(mergedContent) : mergedContent;
        // Get next sequential version (ensures no duplicates)
        const newVersion = getNextVersion(db, fileKey);
        const now = new Date().toISOString();
        // Update working copy
        db.prepare(`
      UPDATE prompt_working_copies
      SET content = ?, version = ?, last_fix_id = ?, updated_at = ?
      WHERE file_key = ?
    `).run(contentToSave, newVersion, fixId, now, fileKey);
        // Create version history entry
        db.prepare(`
      INSERT INTO prompt_version_history (file_key, version, content, fix_id, change_description, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fileKey, newVersion, contentToSave, fixId, fix.change_description, now);
        // Update fix status to 'applied'
        db.prepare(`
      UPDATE generated_fixes SET status = 'applied' WHERE fix_id = ?
    `).run(fixId);
        return {
            newVersion,
            content: contentToSave,
            warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
        };
    }
    finally {
        db.close();
    }
}
/**
 * Merge a fix's change code into the existing content
 * Handles location-based insertion for prompts and tools
 *
 * IMPORTANT: This function tries multiple strategies to find the right insertion point.
 * It will NOT blindly append to end - that's what caused the broken file issue.
 */
function mergeFixIntoContent(content, fix) {
    const { changeCode, location } = fix;
    const lines = content.split('\n');
    // Strategy 1: Use explicit location if provided
    if (location) {
        // Handle section-based insertion (for prompts with XML-like sections)
        if (location.section) {
            const result = insertIntoSection(lines, location.section, changeCode);
            if (result)
                return result;
        }
        // Handle function-based insertion (for JS files)
        if (location.function) {
            const result = insertIntoFunction(lines, location.function, changeCode);
            if (result)
                return result;
        }
        // Handle afterLine insertion
        if (location.afterLine) {
            const result = insertAfterLine(lines, location.afterLine, changeCode);
            if (result)
                return result;
        }
    }
    // Strategy 2: Try to detect insertion point from the changeCode itself
    const smartResult = smartInsert(lines, changeCode, fix.targetFile);
    if (smartResult)
        return smartResult;
    // Strategy 3: FAIL SAFE - Don't blindly append, throw an error instead
    // This prevents the broken file scenario
    throw new Error(`Could not determine safe insertion point for fix. ` +
        `Target: ${fix.targetFile}, Location: ${JSON.stringify(location)}. ` +
        `Please specify a more precise location (section, function, or afterLine).`);
}
/**
 * Insert code into an XML-like section
 */
function insertIntoSection(lines, section, code) {
    const sectionPattern = new RegExp(`<${section}[^>]*>`, 'i');
    const sectionEndPattern = new RegExp(`</${section}>`, 'i');
    let insideSection = false;
    let sectionEndIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (sectionPattern.test(lines[i])) {
            insideSection = true;
        }
        if (insideSection && sectionEndPattern.test(lines[i])) {
            sectionEndIndex = i;
            break;
        }
    }
    if (sectionEndIndex > 0) {
        lines.splice(sectionEndIndex, 0, '', code);
        return lines.join('\n');
    }
    return null;
}
/**
 * Insert code into a JavaScript function body
 */
function insertIntoFunction(lines, funcName, code) {
    const funcPattern = new RegExp(`(function\\s+${funcName}\\s*\\(|const\\s+${funcName}\\s*=\\s*(async\\s+)?function|const\\s+${funcName}\\s*=\\s*(async\\s+)?\\()`, 'i');
    for (let i = 0; i < lines.length; i++) {
        if (funcPattern.test(lines[i])) {
            // Find the opening brace and track to the closing brace
            let braceCount = 0;
            let startedCounting = false;
            let funcEnd = -1;
            for (let j = i; j < lines.length; j++) {
                const line = lines[j];
                for (const char of line) {
                    if (char === '{') {
                        braceCount++;
                        startedCounting = true;
                    }
                    else if (char === '}') {
                        braceCount--;
                    }
                }
                if (startedCounting && braceCount === 0) {
                    funcEnd = j;
                    break;
                }
            }
            if (funcEnd > i) {
                // Insert before the closing brace, with proper indentation
                const indent = lines[funcEnd].match(/^(\s*)/)?.[1] || '';
                const indentedCode = code.split('\n').map(l => indent + '  ' + l).join('\n');
                lines.splice(funcEnd, 0, indentedCode);
                return lines.join('\n');
            }
        }
    }
    return null;
}
/**
 * Insert code after a specific line pattern
 */
function insertAfterLine(lines, afterLine, code) {
    const escapedPattern = afterLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const afterLinePattern = new RegExp(escapedPattern, 'i');
    for (let i = 0; i < lines.length; i++) {
        if (afterLinePattern.test(lines[i])) {
            lines.splice(i + 1, 0, '', code);
            return lines.join('\n');
        }
    }
    return null;
}
/**
 * Smart insertion - try to detect where the code should go based on its content
 */
function smartInsert(lines, code, _targetFile) {
    // Detect if this is a switch case modification
    const caseMatch = code.match(/case\s+['"]([^'"]+)['"]\s*:/);
    if (caseMatch) {
        const caseName = caseMatch[1];
        return insertIntoCaseBlock(lines, caseName, code);
    }
    // Detect if this modifies a specific variable assignment
    const varMatch = code.match(/^(\s*)(const|let|var)?\s*(\w+)\s*(=|\+=|-=)/);
    if (varMatch) {
        const varName = varMatch[3];
        return insertNearVariable(lines, varName, code);
    }
    // Detect if this is adding to an object property
    const propMatch = code.match(/^(\s*)(\w+)\s*:\s*/);
    if (propMatch) {
        const propName = propMatch[2];
        // Try to find the object context
        return insertIntoObjectWithProperty(lines, propName, code);
    }
    return null;
}
/**
 * Insert code into a switch case block
 */
function insertIntoCaseBlock(lines, caseName, code) {
    const casePattern = new RegExp(`case\\s+['"]${caseName}['"]\\s*:`, 'i');
    for (let i = 0; i < lines.length; i++) {
        if (casePattern.test(lines[i])) {
            // Find the opening brace of the case block
            let braceCount = 0;
            let startedCounting = false;
            let caseBlockEnd = -1;
            for (let j = i; j < lines.length; j++) {
                const line = lines[j];
                // Check if we hit the next case or default
                if (j > i && /^\s*(case\s+|default\s*:)/.test(line)) {
                    caseBlockEnd = j - 1;
                    break;
                }
                for (const char of line) {
                    if (char === '{') {
                        braceCount++;
                        startedCounting = true;
                    }
                    else if (char === '}') {
                        braceCount--;
                        if (startedCounting && braceCount === 0) {
                            caseBlockEnd = j;
                            break;
                        }
                    }
                }
                if (caseBlockEnd > 0)
                    break;
            }
            if (caseBlockEnd > i) {
                // Insert at the beginning of the case block (after the case line and opening brace)
                const insertPoint = findFirstCodeLineInCase(lines, i);
                if (insertPoint > i) {
                    const indent = lines[insertPoint].match(/^(\s*)/)?.[1] || '                ';
                    const indentedCode = code.split('\n').map(l => l.trim() ? indent + l.trim() : l).join('\n');
                    lines.splice(insertPoint, 0, indentedCode);
                    return lines.join('\n');
                }
            }
        }
    }
    return null;
}
/**
 * Find the first code line inside a case block
 */
function findFirstCodeLineInCase(lines, caseLineIndex) {
    // Look for the opening brace
    for (let i = caseLineIndex; i < Math.min(caseLineIndex + 5, lines.length); i++) {
        if (lines[i].includes('{')) {
            // Return the line after the brace
            return i + 1;
        }
    }
    // If no brace found, return line after case
    return caseLineIndex + 1;
}
/**
 * Insert code near a variable definition
 */
function insertNearVariable(lines, varName, code) {
    const varPattern = new RegExp(`(const|let|var)\\s+${varName}\\s*=`);
    for (let i = 0; i < lines.length; i++) {
        if (varPattern.test(lines[i])) {
            // Find the end of the variable assignment
            let braceCount = 0;
            let endLine = i;
            for (let j = i; j < lines.length; j++) {
                const line = lines[j];
                braceCount += (line.match(/{/g) || []).length;
                braceCount -= (line.match(/}/g) || []).length;
                if (line.includes(';') && braceCount === 0) {
                    endLine = j;
                    break;
                }
            }
            lines.splice(endLine + 1, 0, '', code);
            return lines.join('\n');
        }
    }
    return null;
}
/**
 * Insert code into an object that has a specific property
 */
function insertIntoObjectWithProperty(_lines, _propName, _code) {
    // This is a complex operation - for now, return null and let it fail safe
    return null;
}
/**
 * Get content of a specific version
 */
function getVersionContent(fileKey, version) {
    const db = getReadOnlyDb();
    try {
        const row = db.prepare(`
      SELECT content FROM prompt_version_history
      WHERE file_key = ? AND version = ?
    `).get(fileKey, version);
        return row ? row.content : null;
    }
    finally {
        db.close();
    }
}
/**
 * Sync working copy to disk (write current version to the actual file)
 */
function syncToDisk(fileKey) {
    const db = getReadOnlyDb();
    try {
        const row = db.prepare(`
      SELECT content, file_path FROM prompt_working_copies WHERE file_key = ?
    `).get(fileKey);
        if (!row) {
            return false;
        }
        fs_1.default.writeFileSync(row.file_path, row.content, 'utf-8');
        return true;
    }
    finally {
        db.close();
    }
}
/**
 * Save new content as a new version
 * This allows direct content updates without going through the fix system
 *
 * @param fileKey - The file key (system_prompt, scheduling_tool, etc.)
 * @param content - The new content to save
 * @param changeDescription - Description of the change
 * @returns The new version number and any warnings
 */
function saveNewVersion(fileKey, content, changeDescription) {
    // Ensure working copies are initialized
    initializeWorkingCopies();
    const db = getWritableDb();
    try {
        // Get current working copy
        const current = db.prepare(`
      SELECT content, version FROM prompt_working_copies WHERE file_key = ?
    `).get(fileKey);
        if (!current) {
            throw new Error(`Prompt file not found: ${fileKey}`);
        }
        // Validate the new content before saving
        const validation = validateContent(content, fileKey);
        if (!validation.valid) {
            throw new Error(`Content validation failed:\n${validation.errors.join('\n')}\n\n` +
                `The new version was NOT saved to prevent broken content.`);
        }
        // Escape curly braces for Flowise compatibility (only for non-JS files like system_prompt)
        const isJavaScriptFile = fileKey.includes('tool') || fileKey.endsWith('.js');
        const contentToSave = !isJavaScriptFile ? escapeForFlowise(content) : content;
        // Get next sequential version (ensures no duplicates)
        const newVersion = getNextVersion(db, fileKey);
        const now = new Date().toISOString();
        // Update working copy
        db.prepare(`
      UPDATE prompt_working_copies
      SET content = ?, version = ?, updated_at = ?
      WHERE file_key = ?
    `).run(contentToSave, newVersion, now, fileKey);
        // Create version history entry
        db.prepare(`
      INSERT INTO prompt_version_history (file_key, version, content, fix_id, change_description, created_at)
      VALUES (?, ?, ?, NULL, ?, ?)
    `).run(fileKey, newVersion, contentToSave, changeDescription, now);
        return {
            newVersion,
            content: contentToSave,
            warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
        };
    }
    finally {
        db.close();
    }
}
/**
 * Apply multiple fixes to their respective target files
 * Groups fixes by target file and applies them sequentially
 * Escapes curly braces for Flowise compatibility in non-JS files
 *
 * @param fixIds - Array of fix IDs to apply
 * @returns Results for each fix application
 */
function applyBatchFixes(fixIds) {
    // Ensure working copies are initialized
    initializeWorkingCopies();
    const db = getWritableDb();
    const results = [];
    const filesModified = new Set();
    try {
        // Get all fix details
        const fixes = [];
        for (const fixId of fixIds) {
            const fix = db.prepare(`
        SELECT fix_id, type, target_file, change_description, change_code, location_json
        FROM generated_fixes
        WHERE fix_id = ? AND status = 'pending'
      `).get(fixId);
            if (!fix) {
                results.push({
                    fixId,
                    success: false,
                    error: `Fix not found or already applied: ${fixId}`,
                });
                continue;
            }
            fixes.push({
                fixId: fix.fix_id,
                type: fix.type,
                targetFile: fix.target_file,
                changeDescription: fix.change_description,
                changeCode: fix.change_code,
                location: fix.location_json ? JSON.parse(fix.location_json) : null,
            });
        }
        // Determine target file key for each fix
        const fixesWithFileKeys = fixes.map(fix => ({
            ...fix,
            fileKey: determineFileKey(fix.targetFile, fix.type),
        }));
        // Group fixes by file key
        const fixesByFile = new Map();
        for (const fix of fixesWithFileKeys) {
            if (!fix.fileKey) {
                results.push({
                    fixId: fix.fixId,
                    success: false,
                    error: `Could not determine target file for: ${fix.targetFile}`,
                });
                continue;
            }
            const existing = fixesByFile.get(fix.fileKey) || [];
            existing.push(fix);
            fixesByFile.set(fix.fileKey, existing);
        }
        // Apply fixes to each file
        for (const [fileKey, fileFixes] of fixesByFile) {
            // Get current working copy
            const current = db.prepare(`
        SELECT content, version FROM prompt_working_copies WHERE file_key = ?
      `).get(fileKey);
            if (!current) {
                for (const fix of fileFixes) {
                    results.push({
                        fixId: fix.fixId,
                        success: false,
                        error: `Target file not found: ${fileKey}`,
                    });
                }
                continue;
            }
            let workingContent = current.content;
            // Start from next version minus 1, so first increment gives us the correct next version
            let currentVersion = getNextVersion(db, fileKey) - 1;
            const isJavaScriptFile = fileKey.includes('tool') || fileKey.endsWith('.js');
            // Apply each fix to this file sequentially
            for (const fix of fileFixes) {
                try {
                    // Merge fix into content
                    let mergedContent = mergeFixIntoContent(workingContent, {
                        fixId: fix.fixId,
                        type: fix.type,
                        targetFile: fix.targetFile,
                        changeDescription: fix.changeDescription,
                        changeCode: fix.changeCode,
                        location: fix.location,
                    });
                    // Escape curly braces for Flowise compatibility (only for non-JS files)
                    if (!isJavaScriptFile) {
                        mergedContent = escapeForFlowise(mergedContent);
                    }
                    // Validate merged content
                    const validation = validateContent(mergedContent, fileKey);
                    if (!validation.valid) {
                        results.push({
                            fixId: fix.fixId,
                            success: false,
                            fileKey,
                            error: `Validation failed: ${validation.errors.join('; ')}`,
                        });
                        continue;
                    }
                    // Update working content for next fix
                    workingContent = mergedContent;
                    currentVersion++;
                    const now = new Date().toISOString();
                    // Update working copy
                    db.prepare(`
            UPDATE prompt_working_copies
            SET content = ?, version = ?, last_fix_id = ?, updated_at = ?
            WHERE file_key = ?
          `).run(mergedContent, currentVersion, fix.fixId, now, fileKey);
                    // Create version history entry
                    db.prepare(`
            INSERT INTO prompt_version_history (file_key, version, content, fix_id, change_description, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(fileKey, currentVersion, mergedContent, fix.fixId, fix.changeDescription, now);
                    // Update fix status to 'applied'
                    db.prepare(`
            UPDATE generated_fixes SET status = 'applied' WHERE fix_id = ?
          `).run(fix.fixId);
                    filesModified.add(fileKey);
                    results.push({
                        fixId: fix.fixId,
                        success: true,
                        fileKey,
                        newVersion: currentVersion,
                        warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
                    });
                }
                catch (error) {
                    results.push({
                        fixId: fix.fixId,
                        success: false,
                        fileKey,
                        error: error.message,
                    });
                }
            }
        }
    }
    finally {
        db.close();
    }
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    return {
        results,
        summary: {
            total: fixIds.length,
            successful,
            failed,
            filesModified: Array.from(filesModified),
        },
    };
}
/**
 * Determine the file key based on target file path and fix type
 */
function determineFileKey(targetFile, type) {
    const targetLower = targetFile?.toLowerCase() || '';
    // Check for scheduling-related files
    if (targetLower.includes('schedule') || targetLower.includes('scheduling') || targetLower.includes('appointment')) {
        return 'scheduling_tool';
    }
    // Check for patient-related files
    if (targetLower.includes('patient')) {
        return 'patient_tool';
    }
    // Check for system prompt
    if (targetLower.includes('systemprompt') || targetLower.includes('system_prompt') || targetLower.includes('chord_cloud9')) {
        return 'system_prompt';
    }
    // Fallback based on fix type
    if (type === 'tool') {
        // Default to scheduling tool for tool fixes
        return 'scheduling_tool';
    }
    // Default to system prompt for prompt fixes
    return 'system_prompt';
}
/**
 * Reset working copy from disk (discard all changes and reload from source file)
 */
function resetFromDisk(fileKey) {
    const mapping = PROMPT_FILE_MAPPINGS[fileKey];
    if (!mapping) {
        throw new Error(`Unknown file key: ${fileKey}`);
    }
    if (!fs_1.default.existsSync(mapping.path)) {
        throw new Error(`Source file not found: ${mapping.path}`);
    }
    const content = fs_1.default.readFileSync(mapping.path, 'utf-8');
    const db = getWritableDb();
    try {
        const current = db.prepare(`
      SELECT version FROM prompt_working_copies WHERE file_key = ?
    `).get(fileKey);
        // Get next sequential version (ensures no duplicates)
        const newVersion = getNextVersion(db, fileKey);
        const now = new Date().toISOString();
        if (current) {
            // Update existing working copy
            db.prepare(`
        UPDATE prompt_working_copies
        SET content = ?, version = ?, updated_at = ?, last_fix_id = NULL
        WHERE file_key = ?
      `).run(content, newVersion, now, fileKey);
        }
        else {
            // Create new working copy
            db.prepare(`
        INSERT INTO prompt_working_copies (file_key, file_path, display_name, content, version, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(fileKey, mapping.path, mapping.displayName, content, newVersion, now);
        }
        // Create version history entry
        db.prepare(`
      INSERT INTO prompt_version_history (file_key, version, content, fix_id, change_description, created_at)
      VALUES (?, ?, ?, NULL, 'Reset from disk file', ?)
    `).run(fileKey, newVersion, content, now);
        return { version: newVersion, content };
    }
    finally {
        db.close();
    }
}
// ============================================================================
// DEPLOYMENT TRACKING
// ============================================================================
/**
 * Initialize the deployment tracking table if it doesn't exist
 */
function ensureDeploymentTable(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_deployments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_key TEXT NOT NULL,
      version INTEGER NOT NULL,
      deployed_at TEXT NOT NULL,
      deployed_by TEXT,
      notes TEXT,
      UNIQUE(file_key, version)
    )
  `);
}
/**
 * Get deployed versions for all prompt files
 * Returns a map of fileKey -> most recently deployed version
 */
function getDeployedVersions() {
    const db = getWritableDb();
    try {
        ensureDeploymentTable(db);
        const rows = db.prepare(`
      SELECT file_key, MAX(version) as version
      FROM prompt_deployments
      GROUP BY file_key
    `).all();
        const result = {};
        for (const row of rows) {
            result[row.file_key] = row.version;
        }
        return result;
    }
    finally {
        db.close();
    }
}
/**
 * Mark a prompt version as deployed to Flowise
 */
function markAsDeployed(fileKey, version, deployedBy, notes) {
    const db = getWritableDb();
    try {
        ensureDeploymentTable(db);
        const now = new Date().toISOString();
        // Insert or update deployment record
        db.prepare(`
      INSERT OR REPLACE INTO prompt_deployments (file_key, version, deployed_at, deployed_by, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(fileKey, version, now, deployedBy || null, notes || null);
        return {
            success: true,
            message: `Marked ${fileKey} v${version} as deployed`,
        };
    }
    finally {
        db.close();
    }
}
/**
 * Get deployment history for a prompt file
 */
function getDeploymentHistory(fileKey, limit = 10) {
    const db = getWritableDb();
    try {
        ensureDeploymentTable(db);
        const rows = db.prepare(`
      SELECT version, deployed_at, deployed_by, notes
      FROM prompt_deployments
      WHERE file_key = ?
      ORDER BY deployed_at DESC
      LIMIT ?
    `).all(fileKey, limit);
        return rows.map(row => ({
            version: row.version,
            deployedAt: row.deployed_at,
            deployedBy: row.deployed_by,
            notes: row.notes,
        }));
    }
    finally {
        db.close();
    }
}
// ============================================================================
// VERSION ROLLBACK (Phase 8)
// ============================================================================
/**
 * Rollback to a previous version
 * Creates a new version with the content from the target version
 *
 * @param fileKey - The file key to rollback
 * @param targetVersion - The version to rollback to
 * @returns The new version number and rolled back content
 */
function rollbackToVersion(fileKey, targetVersion) {
    // Get the content from the target version
    const targetContent = getVersionContent(fileKey, targetVersion);
    if (!targetContent) {
        throw new Error(`Version ${targetVersion} not found for ${fileKey}`);
    }
    // Get current version for reference
    const current = getPromptContent(fileKey);
    const originalVersion = current?.version || 0;
    // Save as a new version with a rollback description
    const result = saveNewVersion(fileKey, targetContent, `Rolled back to version ${targetVersion}`);
    return {
        newVersion: result.newVersion,
        content: result.content,
        originalVersion,
    };
}
/**
 * Get diff between two versions
 * Returns lines that differ between the two versions
 *
 * @param fileKey - The file key
 * @param version1 - First version number
 * @param version2 - Second version number
 * @returns Diff summary
 */
function getVersionDiff(fileKey, version1, version2) {
    const content1 = getVersionContent(fileKey, version1);
    const content2 = getVersionContent(fileKey, version2);
    if (!content1 || !content2) {
        throw new Error('One or both versions not found');
    }
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    // Simple diff: count lines that differ
    const set1 = new Set(lines1);
    const set2 = new Set(lines2);
    let addedLines = 0;
    let removedLines = 0;
    for (const line of lines2) {
        if (!set1.has(line))
            addedLines++;
    }
    for (const line of lines1) {
        if (!set2.has(line))
            removedLines++;
    }
    return {
        version1Lines: lines1.length,
        version2Lines: lines2.length,
        addedLines,
        removedLines,
        changedLines: Math.min(addedLines, removedLines),
    };
}
// ============================================================================
// QUALITY SCORE CACHING
// ============================================================================
/**
 * Initialize the quality scores cache table if it doesn't exist
 */
function ensureQualityScoreTable(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_quality_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_key TEXT NOT NULL,
      version INTEGER NOT NULL,
      overall_score REAL NOT NULL,
      dimensions_json TEXT NOT NULL,
      suggestions_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(file_key, version)
    )
  `);
}
/**
 * Get cached quality score for a prompt version
 * @returns The cached score or null if not found
 */
function getCachedQualityScore(fileKey, version) {
    const db = getWritableDb();
    try {
        ensureQualityScoreTable(db);
        const row = db.prepare(`
      SELECT overall_score, dimensions_json, suggestions_json
      FROM prompt_quality_scores
      WHERE file_key = ? AND version = ?
    `).get(fileKey, version);
        if (!row) {
            return null;
        }
        return {
            overall: row.overall_score,
            dimensions: JSON.parse(row.dimensions_json),
            suggestions: JSON.parse(row.suggestions_json),
        };
    }
    finally {
        db.close();
    }
}
/**
 * Save quality score to cache
 */
function saveQualityScoreToCache(fileKey, version, score) {
    const db = getWritableDb();
    try {
        ensureQualityScoreTable(db);
        const now = new Date().toISOString();
        db.prepare(`
      INSERT OR REPLACE INTO prompt_quality_scores
      (file_key, version, overall_score, dimensions_json, suggestions_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fileKey, version, score.overall, JSON.stringify(score.dimensions), JSON.stringify(score.suggestions), now);
    }
    finally {
        db.close();
    }
}
/**
 * Clear cached quality scores for a file (e.g., when content changes)
 */
function clearQualityScoreCache(fileKey, version) {
    const db = getWritableDb();
    try {
        ensureQualityScoreTable(db);
        if (version !== undefined) {
            db.prepare(`
        DELETE FROM prompt_quality_scores
        WHERE file_key = ? AND version = ?
      `).run(fileKey, version);
        }
        else {
            db.prepare(`
        DELETE FROM prompt_quality_scores
        WHERE file_key = ?
      `).run(fileKey);
        }
    }
    finally {
        db.close();
    }
}
//# sourceMappingURL=promptService.js.map