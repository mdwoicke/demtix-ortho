"use strict";
/**
 * Claude CLI Service
 * Wraps the Claude CLI as a subprocess for LLM operations
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
exports.claudeCliService = exports.ClaudeCliService = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// ============================================================================
// Claude CLI Service
// ============================================================================
class ClaudeCliService {
    constructor() {
        this.statusCache = null;
        this.statusCacheTime = 0;
        this.STATUS_CACHE_TTL = 600000; // 10 minutes (prevent mid-diagnosis fallbacks)
    }
    static getInstance() {
        if (!ClaudeCliService.instance) {
            ClaudeCliService.instance = new ClaudeCliService();
        }
        return ClaudeCliService.instance;
    }
    /**
     * Check if Claude CLI is installed and authenticated
     */
    async checkStatus() {
        // Return cached status if fresh
        if (this.statusCache && Date.now() - this.statusCacheTime < this.STATUS_CACHE_TTL) {
            return this.statusCache;
        }
        try {
            // Check if CLI is installed by running --version
            const versionResult = await this.runCommand(['--version'], 10000);
            if (!versionResult.success) {
                this.statusCache = {
                    installed: false,
                    authenticated: false,
                    error: 'Claude CLI not installed or not in PATH',
                };
                this.statusCacheTime = Date.now();
                return this.statusCache;
            }
            // Check if authenticated by running a minimal prompt via temp file
            const tempFile = path.join(os.tmpdir(), `claude-auth-check-${Date.now()}.txt`);
            fs.writeFileSync(tempFile, 'respond with only: ok', 'utf8');
            const authResult = await this.runCommand([
                '--print',
                '--output-format', 'json',
                '--model', 'haiku',
            ], 15000, tempFile);
            try {
                fs.unlinkSync(tempFile);
            }
            catch { /* ignore */ }
            this.statusCache = {
                installed: true,
                authenticated: authResult.success,
                version: versionResult.result?.trim(),
                error: authResult.success ? undefined : 'Claude CLI not authenticated. Run "claude login" to authenticate.',
            };
            this.statusCacheTime = Date.now();
            return this.statusCache;
        }
        catch (error) {
            this.statusCache = {
                installed: false,
                authenticated: false,
                error: error.message,
            };
            this.statusCacheTime = Date.now();
            return this.statusCache;
        }
    }
    /**
     * Clear the status cache to force a fresh check
     */
    clearStatusCache() {
        this.statusCache = null;
        this.statusCacheTime = 0;
    }
    /**
     * Execute a prompt via Claude CLI
     */
    async execute(request) {
        const startTime = Date.now();
        const buildResult = this.buildArgs(request);
        const { args, tempFile } = buildResult;
        const usePipe = 'usePipe' in buildResult && buildResult.usePipe;
        const timeout = request.timeout || 120000;
        // Helper to clean up temp file
        const cleanup = () => {
            if (tempFile) {
                try {
                    fs.unlinkSync(tempFile);
                }
                catch {
                    // Ignore cleanup errors
                }
            }
        };
        try {
            const result = await this.runCommand(args, timeout, usePipe ? tempFile : undefined);
            cleanup();
            const durationMs = Date.now() - startTime;
            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'CLI execution failed',
                    durationMs,
                };
            }
            // Try to parse JSON response from CLI
            try {
                const jsonResponse = JSON.parse(result.result || '{}');
                return {
                    success: !jsonResponse.is_error,
                    result: jsonResponse.result || result.result,
                    durationMs: jsonResponse.duration_ms || durationMs,
                    usage: jsonResponse.usage ? {
                        inputTokens: jsonResponse.usage.input_tokens || 0,
                        outputTokens: jsonResponse.usage.output_tokens || 0,
                        costUsd: jsonResponse.total_cost_usd || 0,
                    } : undefined,
                    error: jsonResponse.is_error ? jsonResponse.result : undefined,
                };
            }
            catch {
                // If JSON parsing fails, return raw result
                return {
                    success: true,
                    result: result.result,
                    durationMs,
                };
            }
        }
        catch (error) {
            cleanup();
            return {
                success: false,
                error: error.message,
                durationMs: Date.now() - startTime,
            };
        }
    }
    /**
     * Build CLI arguments from request
     * Returns args array and optional temp file path (caller must clean up)
     * Always uses temp file approach to avoid shell escaping issues on Windows
     */
    buildArgs(request) {
        const args = [
            '--print', // Non-interactive mode
            '--output-format', 'json', // JSON output for parsing
        ];
        // Add model if specified
        if (request.model) {
            args.push('--model', this.mapModelName(request.model));
        }
        // Add system prompt if specified
        if (request.systemPrompt) {
            args.push('--system-prompt', request.systemPrompt);
        }
        // Always use temp file approach to avoid shell escaping issues
        // This is more reliable on Windows where shell escaping is complex
        const tempFile = path.join(os.tmpdir(), `claude-prompt-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
        fs.writeFileSync(tempFile, request.prompt, 'utf8');
        // Don't add -p flag - prompt will be piped via stdin from temp file
        return { args, tempFile, usePipe: true };
    }
    /**
     * Map full model names to CLI aliases
     */
    mapModelName(model) {
        const modelMap = {
            'claude-opus-4-5-20251101': 'opus',
            'claude-sonnet-4-5-20250929': 'sonnet',
            'claude-sonnet-4-20250514': 'sonnet',
            'claude-haiku-4-5-20251001': 'haiku',
        };
        return modelMap[model] || model;
    }
    /**
     * Run a CLI command and return the result
     * Uses execSync which works reliably on Windows (spawn with pipes hangs)
     */
    runCommand(args, timeout = 30000, pipeFromFile // Optional file path to pipe content from
    ) {
        return new Promise((resolve) => {
            const isWindows = process.platform === 'win32';
            // On Windows, need to use claude.cmd and run via shell for proper PATH resolution
            const command = 'claude';
            // Build command string
            const fullCommand = `${command} ${args.map(arg => {
                // Quote arguments containing spaces or special characters
                if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
                    return `"${arg.replace(/"/g, '\\"')}"`;
                }
                return arg;
            }).join(' ')}`;
            try {
                // Build the shell command
                let shellCommand;
                if (isWindows) {
                    if (pipeFromFile) {
                        // Pipe content from file to claude on Windows
                        shellCommand = `cmd.exe /c type "${pipeFromFile}" | ${fullCommand}`;
                    }
                    else {
                        shellCommand = `cmd.exe /c ${fullCommand}`;
                    }
                }
                else {
                    if (pipeFromFile) {
                        // Pipe content from file to claude on Unix
                        shellCommand = `cat "${pipeFromFile}" | ${fullCommand}`;
                    }
                    else {
                        shellCommand = fullCommand;
                    }
                }
                const result = (0, child_process_1.execSync)(shellCommand, {
                    encoding: 'utf8',
                    timeout,
                    env: { ...process.env },
                    stdio: ['pipe', 'pipe', 'pipe'],
                    windowsHide: true,
                });
                resolve({ success: true, result: result.toString() });
            }
            catch (error) {
                // execSync throws on non-zero exit code or timeout
                if (error.killed) {
                    resolve({ success: false, error: `Command timed out after ${timeout}ms` });
                }
                else if (error.status !== undefined) {
                    // Process exited with non-zero code
                    resolve({
                        success: false,
                        error: error.stderr?.toString() || `Exit code: ${error.status}`,
                        result: error.stdout?.toString(), // Include stdout for debugging
                    });
                }
                else {
                    // Other error (e.g., command not found)
                    resolve({ success: false, error: error.message });
                }
            }
        });
    }
}
exports.ClaudeCliService = ClaudeCliService;
// Export singleton
exports.claudeCliService = ClaudeCliService.getInstance();
//# sourceMappingURL=claude-cli-service.js.map