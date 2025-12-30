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
export declare function escapeForFlowise(content: string): string;
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
export declare function unescapeFromFlowise(content: string): string;
/**
 * Detect if content has unescaped braces that would cause Flowise errors.
 *
 * @param content - The content to check
 * @returns Object with detection results
 */
export declare function detectUnescapedBraces(content: string): {
    hasUnescaped: boolean;
    count: number;
    positions: {
        index: number;
        char: string;
        context: string;
    }[];
};
export interface PromptFile {
    fileKey: string;
    filePath: string;
    displayName: string;
    version: number;
    lastFixId: string | null;
    updatedAt: string;
}
export interface PromptVersionHistory {
    id: number;
    fileKey: string;
    version: number;
    content: string;
    fixId: string | null;
    changeDescription: string | null;
    createdAt: string;
}
export interface GeneratedFix {
    fixId: string;
    type: 'prompt' | 'tool';
    targetFile: string;
    changeDescription: string;
    changeCode: string;
    location: {
        section?: string;
        function?: string;
        afterLine?: string;
    } | null;
}
/**
 * Initialize working copies from disk files if they don't exist
 */
export declare function initializeWorkingCopies(): void;
/**
 * Get all prompt files with their current version info
 */
export declare function getPromptFiles(): PromptFile[];
/**
 * Get current content for a specific prompt file
 */
export declare function getPromptContent(fileKey: string): {
    content: string;
    version: number;
} | null;
/**
 * Get version history for a prompt file
 */
export declare function getPromptHistory(fileKey: string, limit?: number): PromptVersionHistory[];
/**
 * Apply a fix to a prompt and create a new version
 *
 * IMPORTANT: This function validates the merged content BEFORE saving.
 * If validation fails, the fix is NOT applied and an error is thrown.
 */
export declare function applyFix(fileKey: string, fixId: string): {
    newVersion: number;
    content: string;
    warnings?: string[];
};
/**
 * Get content of a specific version
 */
export declare function getVersionContent(fileKey: string, version: number): string | null;
/**
 * Sync working copy to disk (write current version to the actual file)
 */
export declare function syncToDisk(fileKey: string): boolean;
/**
 * Save new content as a new version
 * This allows direct content updates without going through the fix system
 *
 * @param fileKey - The file key (system_prompt, scheduling_tool, etc.)
 * @param content - The new content to save
 * @param changeDescription - Description of the change
 * @returns The new version number and any warnings
 */
export declare function saveNewVersion(fileKey: string, content: string, changeDescription: string): {
    newVersion: number;
    content: string;
    warnings?: string[];
};
/**
 * Apply multiple fixes to their respective target files
 * Groups fixes by target file and applies them sequentially
 * Escapes curly braces for Flowise compatibility in non-JS files
 *
 * @param fixIds - Array of fix IDs to apply
 * @returns Results for each fix application
 */
export declare function applyBatchFixes(fixIds: string[]): {
    results: Array<{
        fixId: string;
        success: boolean;
        fileKey?: string;
        newVersion?: number;
        error?: string;
        warnings?: string[];
    }>;
    summary: {
        total: number;
        successful: number;
        failed: number;
        filesModified: string[];
    };
};
/**
 * Reset working copy from disk (discard all changes and reload from source file)
 */
export declare function resetFromDisk(fileKey: string): {
    version: number;
    content: string;
};
/**
 * Get deployed versions for all prompt files
 * Returns a map of fileKey -> most recently deployed version
 */
export declare function getDeployedVersions(): Record<string, number>;
/**
 * Mark a prompt version as deployed to Flowise
 */
export declare function markAsDeployed(fileKey: string, version: number, deployedBy?: string, notes?: string): {
    success: boolean;
    message: string;
};
/**
 * Get deployment history for a prompt file
 */
export declare function getDeploymentHistory(fileKey: string, limit?: number): Array<{
    version: number;
    deployedAt: string;
    deployedBy: string | null;
    notes: string | null;
}>;
/**
 * Rollback to a previous version
 * Creates a new version with the content from the target version
 *
 * @param fileKey - The file key to rollback
 * @param targetVersion - The version to rollback to
 * @returns The new version number and rolled back content
 */
export declare function rollbackToVersion(fileKey: string, targetVersion: number): {
    newVersion: number;
    content: string;
    originalVersion: number;
};
/**
 * Get diff between two versions
 * Returns lines that differ between the two versions
 *
 * @param fileKey - The file key
 * @param version1 - First version number
 * @param version2 - Second version number
 * @returns Diff summary
 */
export declare function getVersionDiff(fileKey: string, version1: number, version2: number): {
    version1Lines: number;
    version2Lines: number;
    addedLines: number;
    removedLines: number;
    changedLines: number;
};
/**
 * Quality score structure
 */
export interface CachedQualityScore {
    overall: number;
    dimensions: {
        clarity: number;
        completeness: number;
        examples: number;
        consistency: number;
        edgeCases: number;
    };
    suggestions: string[];
}
/**
 * Get cached quality score for a prompt version
 * @returns The cached score or null if not found
 */
export declare function getCachedQualityScore(fileKey: string, version: number): CachedQualityScore | null;
/**
 * Save quality score to cache
 */
export declare function saveQualityScoreToCache(fileKey: string, version: number, score: CachedQualityScore): void;
/**
 * Clear cached quality scores for a file (e.g., when content changes)
 */
export declare function clearQualityScoreCache(fileKey: string, version?: number): void;
//# sourceMappingURL=promptService.d.ts.map