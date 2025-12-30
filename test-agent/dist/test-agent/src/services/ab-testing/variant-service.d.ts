/**
 * Variant Service for A/B Testing
 *
 * Manages the creation, storage, and application of variants.
 * Integrates with GeneratedFix to create testable variants from fix recommendations.
 */
import { Database, GeneratedFix } from '../../storage/database';
import type { CreateVariantInput, Variant } from './types';
export declare class VariantService {
    private db;
    private appliedVariants;
    constructor(db: Database);
    /**
     * Create a new variant
     */
    createVariant(input: CreateVariantInput): Variant;
    /**
     * Create a variant from a GeneratedFix
     * This is the main integration point with LLMAnalysisService
     */
    createVariantFromFix(fix: GeneratedFix): Promise<Variant>;
    /**
     * Create variants from multiple fixes
     */
    createVariantsFromFixes(fixes: GeneratedFix[]): Promise<Variant[]>;
    /**
     * Get a variant by ID
     */
    getVariant(variantId: string): Variant | null;
    /**
     * Get variants for a specific file
     */
    getVariantsForFile(targetFile: string): Variant[];
    /**
     * Get baseline variant for a file
     */
    getBaselineVariant(targetFile: string): Variant | null;
    /**
     * Set a variant as the new baseline
     */
    setAsBaseline(variantId: string): void;
    /**
     * Capture current file contents as baseline
     */
    captureBaseline(targetFile: string, type: 'prompt' | 'tool' | 'config', content?: string): Promise<Variant>;
    /**
     * Capture baselines for all known files
     */
    captureCurrentBaselines(): Promise<Variant[]>;
    /**
     * Temporarily apply a variant for testing
     * Stores original content for rollback
     */
    applyVariant(variantId: string): Promise<void>;
    /**
     * Rollback to original content for a file
     */
    rollback(targetFile: string): Promise<void>;
    /**
     * Rollback all applied variants
     */
    rollbackAll(): Promise<void>;
    /**
     * Find duplicate variant by content hash
     */
    findDuplicateVariant(content: string, targetFile: string): Variant | null;
    /**
     * Get variant content
     */
    getVariantContent(variantId: string): string | null;
    /**
     * Get all variants with optional filters
     */
    getAllVariants(options?: {
        variantType?: 'prompt' | 'tool' | 'config';
        isBaseline?: boolean;
    }): Variant[];
    /**
     * Generate a unique variant ID
     */
    private generateVariantId;
    /**
     * Hash content for deduplication
     */
    private hashContent;
    /**
     * Apply a fix to base content
     */
    private applyFixToContent;
    /**
     * Apply a prompt fix (markdown file)
     */
    private applyPromptFix;
    /**
     * Apply a tool fix (JSON or JS file)
     */
    private applyToolFix;
    /**
     * Apply fix to a function body
     */
    private applyToFunction;
    /**
     * Escape special regex characters
     */
    private escapeRegex;
    /**
     * Get canonical path for database storage/lookup
     * Normalizes paths to a consistent format (e.g., 'docs/...' without '../')
     */
    private getCanonicalPath;
    /**
     * Normalize a file path to handle different reference styles
     * (e.g., 'docs/...' vs '../docs/...')
     */
    private normalizeFilePath;
    /**
     * Read file content
     */
    private readFile;
    /**
     * Write file content
     */
    private writeFile;
    /**
     * Map database ABVariant to service Variant type
     */
    private mapToVariant;
}
//# sourceMappingURL=variant-service.d.ts.map