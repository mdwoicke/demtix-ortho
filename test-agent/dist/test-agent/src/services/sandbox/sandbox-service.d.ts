/**
 * Sandbox Service
 *
 * Manages A/B testing sandboxes with persistent file copies and endpoint configuration.
 * Each sandbox maintains its own version of the 3 Flowise files:
 * - System Prompt (markdown)
 * - Patient Tool (JSON/JS)
 * - Scheduling Tool (JSON/JS)
 */
import { Database, ABSandbox, ABSandboxFile, ABSandboxFileHistory } from '../../storage/database';
export declare class SandboxService {
    private db;
    constructor(db: Database);
    /**
     * Initialize default sandboxes (A and B) if they don't exist
     */
    initializeSandboxes(): void;
    /**
     * Get a sandbox by ID
     */
    getSandbox(sandboxId: string): ABSandbox | null;
    /**
     * Get all sandboxes
     */
    getAllSandboxes(): ABSandbox[];
    /**
     * Update sandbox configuration
     */
    updateSandbox(sandboxId: string, updates: Partial<ABSandbox>): void;
    /**
     * Get sandbox with all its files
     */
    getSandboxWithFiles(sandboxId: string): {
        sandbox: ABSandbox;
        files: ABSandboxFile[];
    } | null;
    /**
     * Get all files for a sandbox
     */
    getSandboxFiles(sandboxId: string): ABSandboxFile[];
    /**
     * Get a specific file from a sandbox
     */
    getSandboxFile(sandboxId: string, fileKey: string): ABSandboxFile | null;
    /**
     * Get file content from a sandbox
     */
    getSandboxFileContent(sandboxId: string, fileKey: string): {
        content: string;
        version: number;
    } | null;
    /**
     * Save/update a sandbox file (creates new version)
     */
    saveSandboxFile(sandboxId: string, fileKey: string, content: string, changeDescription: string): {
        newVersion: number;
    };
    /**
     * Copy a file from production to sandbox
     */
    copyFromProduction(sandboxId: string, fileKey: string): ABSandboxFile;
    /**
     * Copy all 3 files from production to sandbox
     */
    copyAllFromProduction(sandboxId: string): ABSandboxFile[];
    /**
     * Get file version history
     */
    getSandboxFileHistory(sandboxId: string, fileKey: string, limit?: number): ABSandboxFileHistory[];
    /**
     * Rollback a file to a specific version
     */
    rollbackFile(sandboxId: string, fileKey: string, version: number): void;
    /**
     * Reset sandbox to production state (clears all files and copies fresh from production)
     */
    resetToProduction(sandboxId: string): ABSandboxFile[];
    /**
     * Check if sandbox has all required files
     */
    isSandboxComplete(sandboxId: string): {
        complete: boolean;
        missingFiles: string[];
    };
    /**
     * Check if sandbox has a configured endpoint
     */
    hasEndpoint(sandboxId: string): boolean;
    /**
     * Get sandbox status summary
     */
    getSandboxStatus(sandboxId: string): {
        exists: boolean;
        hasEndpoint: boolean;
        hasAllFiles: boolean;
        fileCount: number;
        missingFiles: string[];
        endpoint?: string;
    };
    /**
     * Get files from both sandboxes for comparison
     */
    getComparisonFiles(): {
        sandboxA: ABSandboxFile[];
        sandboxB: ABSandboxFile[];
    };
    /**
     * Get both sandbox configurations for comparison
     */
    getBothSandboxes(): {
        sandboxA: ABSandbox | null;
        sandboxB: ABSandbox | null;
    };
}
//# sourceMappingURL=sandbox-service.d.ts.map