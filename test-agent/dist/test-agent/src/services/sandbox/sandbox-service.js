"use strict";
/**
 * Sandbox Service
 *
 * Manages A/B testing sandboxes with persistent file copies and endpoint configuration.
 * Each sandbox maintains its own version of the 3 Flowise files:
 * - System Prompt (markdown)
 * - Patient Tool (JSON/JS)
 * - Scheduling Tool (JSON/JS)
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
exports.SandboxService = void 0;
const promptService = __importStar(require("../../../../backend/src/services/promptService"));
// File key mappings
const SANDBOX_FILE_KEYS = ['system_prompt', 'patient_tool', 'scheduling_tool'];
const FILE_KEY_CONFIG = {
    system_prompt: { displayName: 'System Prompt', fileType: 'markdown' },
    patient_tool: { displayName: 'Patient Tool', fileType: 'json' },
    scheduling_tool: { displayName: 'Scheduling Tool', fileType: 'json' },
};
class SandboxService {
    constructor(db) {
        this.db = db;
    }
    /**
     * Initialize default sandboxes (A and B) if they don't exist
     */
    initializeSandboxes() {
        this.db.initializeSandboxes();
    }
    // ============================================================================
    // SANDBOX MANAGEMENT
    // ============================================================================
    /**
     * Get a sandbox by ID
     */
    getSandbox(sandboxId) {
        return this.db.getSandbox(sandboxId);
    }
    /**
     * Get all sandboxes
     */
    getAllSandboxes() {
        return this.db.getAllSandboxes();
    }
    /**
     * Update sandbox configuration
     */
    updateSandbox(sandboxId, updates) {
        this.db.updateSandbox(sandboxId, updates);
    }
    /**
     * Get sandbox with all its files
     */
    getSandboxWithFiles(sandboxId) {
        const sandbox = this.db.getSandbox(sandboxId);
        if (!sandbox)
            return null;
        const files = this.db.getSandboxFiles(sandboxId);
        return { sandbox, files };
    }
    // ============================================================================
    // FILE MANAGEMENT
    // ============================================================================
    /**
     * Get all files for a sandbox
     */
    getSandboxFiles(sandboxId) {
        return this.db.getSandboxFiles(sandboxId);
    }
    /**
     * Get a specific file from a sandbox
     */
    getSandboxFile(sandboxId, fileKey) {
        return this.db.getSandboxFile(sandboxId, fileKey);
    }
    /**
     * Get file content from a sandbox
     */
    getSandboxFileContent(sandboxId, fileKey) {
        const file = this.db.getSandboxFile(sandboxId, fileKey);
        if (!file)
            return null;
        return { content: file.content, version: file.version };
    }
    /**
     * Save/update a sandbox file (creates new version)
     */
    saveSandboxFile(sandboxId, fileKey, content, changeDescription) {
        const config = FILE_KEY_CONFIG[fileKey];
        if (!config) {
            throw new Error(`Unknown file key: ${fileKey}`);
        }
        // Get existing file or use defaults
        const existing = this.db.getSandboxFile(sandboxId, fileKey);
        const newVersion = this.db.saveSandboxFile({
            sandboxId,
            fileKey,
            fileType: config.fileType,
            displayName: config.displayName,
            content,
            version: existing ? existing.version + 1 : 1,
            baseVersion: existing?.baseVersion,
            changeDescription,
        });
        return { newVersion };
    }
    /**
     * Copy a file from production to sandbox
     */
    copyFromProduction(sandboxId, fileKey) {
        const config = FILE_KEY_CONFIG[fileKey];
        if (!config) {
            throw new Error(`Unknown file key: ${fileKey}`);
        }
        // Get production content using promptService
        const productionContent = promptService.getPromptContent(fileKey);
        if (!productionContent) {
            throw new Error(`Production file not found: ${fileKey}`);
        }
        // Check if sandbox file already exists
        const existing = this.db.getSandboxFile(sandboxId, fileKey);
        const newVersion = existing ? existing.version + 1 : 1;
        // Save to sandbox
        this.db.saveSandboxFile({
            sandboxId,
            fileKey,
            fileType: config.fileType,
            displayName: config.displayName,
            content: productionContent.content,
            version: newVersion,
            baseVersion: productionContent.version,
            changeDescription: `Copied from production v${productionContent.version}`,
        });
        // Return the saved file
        return this.db.getSandboxFile(sandboxId, fileKey);
    }
    /**
     * Copy all 3 files from production to sandbox
     */
    copyAllFromProduction(sandboxId) {
        const files = [];
        for (const fileKey of SANDBOX_FILE_KEYS) {
            const file = this.copyFromProduction(sandboxId, fileKey);
            files.push(file);
        }
        return files;
    }
    /**
     * Get file version history
     */
    getSandboxFileHistory(sandboxId, fileKey, limit = 20) {
        return this.db.getSandboxFileHistory(sandboxId, fileKey, limit);
    }
    /**
     * Rollback a file to a specific version
     */
    rollbackFile(sandboxId, fileKey, version) {
        this.db.rollbackSandboxFile(sandboxId, fileKey, version);
    }
    /**
     * Reset sandbox to production state (clears all files and copies fresh from production)
     */
    resetToProduction(sandboxId) {
        // Clear all sandbox files
        this.db.clearSandboxFiles(sandboxId);
        // Copy fresh from production
        return this.copyAllFromProduction(sandboxId);
    }
    // ============================================================================
    // VALIDATION
    // ============================================================================
    /**
     * Check if sandbox has all required files
     */
    isSandboxComplete(sandboxId) {
        const files = this.db.getSandboxFiles(sandboxId);
        const fileKeys = new Set(files.map(f => f.fileKey));
        const missingFiles = [];
        for (const key of SANDBOX_FILE_KEYS) {
            if (!fileKeys.has(key)) {
                missingFiles.push(key);
            }
        }
        return {
            complete: missingFiles.length === 0,
            missingFiles,
        };
    }
    /**
     * Check if sandbox has a configured endpoint
     */
    hasEndpoint(sandboxId) {
        const sandbox = this.db.getSandbox(sandboxId);
        return !!(sandbox?.flowiseEndpoint && sandbox.flowiseEndpoint.trim().length > 0);
    }
    /**
     * Get sandbox status summary
     */
    getSandboxStatus(sandboxId) {
        const sandbox = this.db.getSandbox(sandboxId);
        if (!sandbox) {
            return {
                exists: false,
                hasEndpoint: false,
                hasAllFiles: false,
                fileCount: 0,
                missingFiles: [...SANDBOX_FILE_KEYS],
            };
        }
        const { complete, missingFiles } = this.isSandboxComplete(sandboxId);
        const files = this.db.getSandboxFiles(sandboxId);
        return {
            exists: true,
            hasEndpoint: !!(sandbox.flowiseEndpoint && sandbox.flowiseEndpoint.trim().length > 0),
            hasAllFiles: complete,
            fileCount: files.length,
            missingFiles,
            endpoint: sandbox.flowiseEndpoint || undefined,
        };
    }
    // ============================================================================
    // COMPARISON HELPERS
    // ============================================================================
    /**
     * Get files from both sandboxes for comparison
     */
    getComparisonFiles() {
        return {
            sandboxA: this.db.getSandboxFiles('sandbox_a'),
            sandboxB: this.db.getSandboxFiles('sandbox_b'),
        };
    }
    /**
     * Get both sandbox configurations for comparison
     */
    getBothSandboxes() {
        return {
            sandboxA: this.db.getSandbox('sandbox_a'),
            sandboxB: this.db.getSandbox('sandbox_b'),
        };
    }
}
exports.SandboxService = SandboxService;
//# sourceMappingURL=sandbox-service.js.map