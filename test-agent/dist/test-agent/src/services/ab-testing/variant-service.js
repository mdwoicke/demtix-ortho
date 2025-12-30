"use strict";
/**
 * Variant Service for A/B Testing
 *
 * Manages the creation, storage, and application of variants.
 * Integrates with GeneratedFix to create testable variants from fix recommendations.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VariantService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const uuid_1 = require("uuid");
class VariantService {
    constructor(db) {
        this.db = db;
        this.appliedVariants = new Map(); // targetFile -> original content
    }
    /**
     * Create a new variant
     */
    createVariant(input) {
        const contentHash = this.hashContent(input.content);
        // Check for duplicates
        const existing = this.db.findVariantByHash(contentHash, input.targetFile);
        if (existing) {
            return this.mapToVariant(existing);
        }
        const variantId = this.generateVariantId(input.variantType);
        const now = new Date().toISOString();
        const variant = {
            variantId,
            variantType: input.variantType,
            targetFile: input.targetFile,
            name: input.name,
            description: input.description,
            content: input.content,
            contentHash,
            baselineVariantId: input.baselineVariantId,
            sourceFixId: input.sourceFixId,
            isBaseline: false,
            createdAt: now,
            createdBy: input.createdBy || 'manual',
            metadata: input.metadata,
        };
        this.db.saveVariant(variant);
        return this.mapToVariant(variant);
    }
    /**
     * Create a variant from a GeneratedFix
     * This is the main integration point with LLMAnalysisService
     */
    async createVariantFromFix(fix) {
        // Get current baseline for this file using canonical path
        const canonicalPath = this.getCanonicalPath(fix.targetFile);
        const baseline = this.db.getBaselineVariant(canonicalPath);
        // Get base content (from baseline or file system)
        let baseContent;
        if (baseline) {
            baseContent = baseline.content;
        }
        else {
            // Read from file system and capture as baseline
            baseContent = await this.readFile(fix.targetFile);
            await this.captureBaseline(fix.targetFile, fix.type, baseContent);
        }
        // Apply the fix to create variant content
        const variantContent = this.applyFixToContent(baseContent, fix);
        const metadata = {
            section: fix.location?.section,
            changeType: fix.location?.function ? 'tool-function' : 'prompt-section',
            function: fix.location?.function,
            rootCause: fix.rootCause?.type,
            confidence: fix.confidence,
        };
        return this.createVariant({
            variantType: fix.type,
            targetFile: canonicalPath, // Use canonical path for storage
            name: `Fix: ${fix.changeDescription.substring(0, 50)}`,
            description: fix.changeDescription,
            content: variantContent,
            baselineVariantId: baseline?.variantId,
            sourceFixId: fix.fixId,
            createdBy: 'llm-analysis',
            metadata,
        });
    }
    /**
     * Create variants from multiple fixes
     */
    async createVariantsFromFixes(fixes) {
        const variants = [];
        for (const fix of fixes) {
            try {
                const variant = await this.createVariantFromFix(fix);
                variants.push(variant);
            }
            catch (error) {
                console.error(`Failed to create variant from fix ${fix.fixId}:`, error);
            }
        }
        return variants;
    }
    /**
     * Get a variant by ID
     */
    getVariant(variantId) {
        const variant = this.db.getVariant(variantId);
        return variant ? this.mapToVariant(variant) : null;
    }
    /**
     * Get variants for a specific file
     */
    getVariantsForFile(targetFile) {
        return this.db.getVariantsByFile(targetFile).map(v => this.mapToVariant(v));
    }
    /**
     * Get baseline variant for a file
     */
    getBaselineVariant(targetFile) {
        // Use canonical path for lookup
        const canonicalPath = this.getCanonicalPath(targetFile);
        const variant = this.db.getBaselineVariant(canonicalPath);
        return variant ? this.mapToVariant(variant) : null;
    }
    /**
     * Set a variant as the new baseline
     */
    setAsBaseline(variantId) {
        this.db.setVariantAsBaseline(variantId);
    }
    /**
     * Capture current file contents as baseline
     */
    async captureBaseline(targetFile, type, content) {
        const fileContent = content || await this.readFile(targetFile);
        const fileName = path.basename(targetFile);
        // Use canonical path for storage (e.g., 'docs/...' without '../')
        const canonicalPath = this.getCanonicalPath(targetFile);
        const variant = this.createVariant({
            variantType: type,
            targetFile: canonicalPath,
            name: `Baseline: ${fileName}`,
            description: `Original baseline captured from ${fileName}`,
            content: fileContent,
            createdBy: 'manual',
        });
        this.db.setVariantAsBaseline(variant.variantId);
        return variant;
    }
    /**
     * Capture baselines for all known files
     */
    async captureCurrentBaselines() {
        const baselines = [];
        // Define the files to capture (paths relative to project root, not test-agent)
        const filesToCapture = [
            { path: '../docs/Chord_Cloud9_SystemPrompt.md', type: 'prompt' },
            { path: '../docs/chord_dso_scheduling-StepwiseSearch.json', type: 'tool' },
            { path: '../docs/chord_dso_patient-FIXED.json', type: 'tool' },
        ];
        for (const file of filesToCapture) {
            try {
                // Check if baseline already exists using canonical path
                const canonicalPath = this.getCanonicalPath(file.path);
                const existing = this.db.getBaselineVariant(canonicalPath);
                if (!existing) {
                    const baseline = await this.captureBaseline(file.path, file.type);
                    baselines.push(baseline);
                }
            }
            catch (error) {
                console.error(`Failed to capture baseline for ${file.path}:`, error);
            }
        }
        return baselines;
    }
    /**
     * Temporarily apply a variant for testing
     * Stores original content for rollback
     */
    async applyVariant(variantId) {
        const variant = this.db.getVariant(variantId);
        if (!variant) {
            throw new Error(`Variant ${variantId} not found`);
        }
        // Store original content if not already stored
        if (!this.appliedVariants.has(variant.targetFile)) {
            const originalContent = await this.readFile(variant.targetFile);
            this.appliedVariants.set(variant.targetFile, originalContent);
        }
        // Write variant content to file
        await this.writeFile(variant.targetFile, variant.content);
    }
    /**
     * Rollback to original content for a file
     */
    async rollback(targetFile) {
        const originalContent = this.appliedVariants.get(targetFile);
        if (originalContent) {
            await this.writeFile(targetFile, originalContent);
            this.appliedVariants.delete(targetFile);
        }
    }
    /**
     * Rollback all applied variants
     */
    async rollbackAll() {
        for (const [targetFile, originalContent] of this.appliedVariants) {
            await this.writeFile(targetFile, originalContent);
        }
        this.appliedVariants.clear();
    }
    /**
     * Find duplicate variant by content hash
     */
    findDuplicateVariant(content, targetFile) {
        const contentHash = this.hashContent(content);
        const variant = this.db.findVariantByHash(contentHash, targetFile);
        return variant ? this.mapToVariant(variant) : null;
    }
    /**
     * Get variant content
     */
    getVariantContent(variantId) {
        const variant = this.db.getVariant(variantId);
        return variant?.content || null;
    }
    /**
     * Get all variants with optional filters
     */
    getAllVariants(options) {
        return this.db.getAllVariants(options).map(v => this.mapToVariant(v));
    }
    // ============================================================================
    // PRIVATE HELPER METHODS
    // ============================================================================
    /**
     * Generate a unique variant ID
     */
    generateVariantId(type) {
        const prefix = type.toUpperCase().substring(0, 4);
        const timestamp = Date.now().toString(36);
        const random = (0, uuid_1.v4)().substring(0, 8);
        return `VAR-${prefix}-${timestamp}-${random}`;
    }
    /**
     * Hash content for deduplication
     */
    hashContent(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    /**
     * Apply a fix to base content
     */
    applyFixToContent(baseContent, fix) {
        if (!fix.changeCode) {
            return baseContent;
        }
        // Handle different fix types
        if (fix.type === 'prompt') {
            return this.applyPromptFix(baseContent, fix);
        }
        else if (fix.type === 'tool') {
            return this.applyToolFix(baseContent, fix);
        }
        return baseContent;
    }
    /**
     * Apply a prompt fix (markdown file)
     */
    applyPromptFix(content, fix) {
        const location = fix.location;
        // If we have a specific section, try to find and modify it
        if (location?.section) {
            const sectionPattern = new RegExp(`(##\\s*${this.escapeRegex(location.section)}[^#]*?)(?=##|$)`, 'is');
            if (sectionPattern.test(content)) {
                // Replace within the section
                return content.replace(sectionPattern, (match) => {
                    if (location.afterLine) {
                        // Insert after a specific line
                        const afterLinePattern = new RegExp(`(${this.escapeRegex(location.afterLine)})`, 'i');
                        return match.replace(afterLinePattern, `$1\n${fix.changeCode}`);
                    }
                    else {
                        // Append to section
                        return match.trimEnd() + '\n' + fix.changeCode + '\n\n';
                    }
                });
            }
        }
        // If afterLine is provided but no section, find it anywhere
        if (location?.afterLine) {
            const afterLinePattern = new RegExp(`(${this.escapeRegex(location.afterLine)})`, 'i');
            if (afterLinePattern.test(content)) {
                return content.replace(afterLinePattern, `$1\n${fix.changeCode}`);
            }
        }
        // If lineNumber is provided
        if (location?.lineNumber) {
            const lines = content.split('\n');
            if (location.lineNumber <= lines.length) {
                lines.splice(location.lineNumber, 0, fix.changeCode);
                return lines.join('\n');
            }
        }
        // Default: append to end
        return content.trimEnd() + '\n\n' + fix.changeCode + '\n';
    }
    /**
     * Apply a tool fix (JSON or JS file)
     */
    applyToolFix(content, fix) {
        const location = fix.location;
        // Try to parse as JSON
        try {
            const parsed = JSON.parse(content);
            // If func field exists (embedded JS), modify it
            if (parsed.func && location?.function) {
                const funcContent = parsed.func;
                const modifiedFunc = this.applyToFunction(funcContent, fix);
                parsed.func = modifiedFunc;
                return JSON.stringify(parsed, null, 2);
            }
            // Otherwise, return as-is with fix appended as comment
            return content;
        }
        catch {
            // Not JSON, treat as JS
            return this.applyToFunction(content, fix);
        }
    }
    /**
     * Apply fix to a function body
     */
    applyToFunction(funcContent, fix) {
        const location = fix.location;
        if (location?.function) {
            // Find the function and insert code
            const funcPattern = new RegExp(`(function\\s+${this.escapeRegex(location.function)}\\s*\\([^)]*\\)\\s*\\{)`, 'i');
            if (funcPattern.test(funcContent)) {
                return funcContent.replace(funcPattern, `$1\n${fix.changeCode}`);
            }
            // Try arrow function pattern
            const arrowPattern = new RegExp(`(const\\s+${this.escapeRegex(location.function)}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{)`, 'i');
            if (arrowPattern.test(funcContent)) {
                return funcContent.replace(arrowPattern, `$1\n${fix.changeCode}`);
            }
        }
        if (location?.afterLine) {
            const afterLinePattern = new RegExp(`(${this.escapeRegex(location.afterLine)})`, 'i');
            if (afterLinePattern.test(funcContent)) {
                return funcContent.replace(afterLinePattern, `$1\n${fix.changeCode}`);
            }
        }
        if (location?.lineNumber) {
            const lines = funcContent.split('\n');
            if (location.lineNumber <= lines.length) {
                lines.splice(location.lineNumber, 0, fix.changeCode);
                return lines.join('\n');
            }
        }
        // Default: append near end (before last closing brace)
        const lastBraceIndex = funcContent.lastIndexOf('}');
        if (lastBraceIndex > 0) {
            return (funcContent.substring(0, lastBraceIndex) +
                '\n' +
                fix.changeCode +
                '\n' +
                funcContent.substring(lastBraceIndex));
        }
        return funcContent + '\n' + fix.changeCode;
    }
    /**
     * Escape special regex characters
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    /**
     * Get canonical path for database storage/lookup
     * Normalizes paths to a consistent format (e.g., 'docs/...' without '../')
     */
    getCanonicalPath(filePath) {
        // Remove leading '../' prefix if present
        if (filePath.startsWith('../')) {
            return filePath.substring(3);
        }
        return filePath;
    }
    /**
     * Normalize a file path to handle different reference styles
     * (e.g., 'docs/...' vs '../docs/...')
     */
    normalizeFilePath(filePath) {
        // If already absolute, return as-is
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        // Try the path as-is first
        const directPath = path.resolve(process.cwd(), filePath);
        if (fs.existsSync(directPath)) {
            return directPath;
        }
        // Try with parent directory prefix (for docs/ -> ../docs/)
        if (filePath.startsWith('docs/')) {
            const parentPath = path.resolve(process.cwd(), '..', filePath);
            if (fs.existsSync(parentPath)) {
                return parentPath;
            }
        }
        // Try removing parent directory prefix (for ../docs/ -> docs/)
        if (filePath.startsWith('../docs/')) {
            const directDocsPath = path.resolve(process.cwd(), filePath.substring(3));
            if (fs.existsSync(directDocsPath)) {
                return directDocsPath;
            }
        }
        // Fallback to original path resolution
        return directPath;
    }
    /**
     * Read file content
     */
    async readFile(filePath) {
        const absolutePath = this.normalizeFilePath(filePath);
        return fs.promises.readFile(absolutePath, 'utf-8');
    }
    /**
     * Write file content
     */
    async writeFile(filePath, content) {
        const absolutePath = this.normalizeFilePath(filePath);
        // Ensure directory exists
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        await fs.promises.writeFile(absolutePath, content, 'utf-8');
    }
    /**
     * Map database ABVariant to service Variant type
     */
    mapToVariant(abVariant) {
        return {
            variantId: abVariant.variantId,
            variantType: abVariant.variantType,
            targetFile: abVariant.targetFile,
            name: abVariant.name,
            description: abVariant.description,
            content: abVariant.content,
            contentHash: abVariant.contentHash,
            baselineVariantId: abVariant.baselineVariantId,
            sourceFixId: abVariant.sourceFixId,
            isBaseline: abVariant.isBaseline,
            createdAt: abVariant.createdAt,
            createdBy: abVariant.createdBy,
            metadata: abVariant.metadata,
        };
    }
}
exports.VariantService = VariantService;
//# sourceMappingURL=variant-service.js.map