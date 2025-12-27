/**
 * Claude CLI Service
 * Wraps the Claude CLI as a subprocess for LLM operations
 */
export interface ClaudeCliRequest {
    prompt: string;
    model?: string;
    systemPrompt?: string;
    timeout?: number;
}
export interface ClaudeCliResponse {
    success: boolean;
    result?: string;
    error?: string;
    durationMs?: number;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
    };
}
export interface ClaudeCliStatus {
    installed: boolean;
    authenticated: boolean;
    version?: string;
    error?: string;
}
export declare class ClaudeCliService {
    private static instance;
    private statusCache;
    private statusCacheTime;
    private readonly STATUS_CACHE_TTL;
    static getInstance(): ClaudeCliService;
    /**
     * Check if Claude CLI is installed and authenticated
     */
    checkStatus(): Promise<ClaudeCliStatus>;
    /**
     * Clear the status cache to force a fresh check
     */
    clearStatusCache(): void;
    /**
     * Execute a prompt via Claude CLI
     */
    execute(request: ClaudeCliRequest): Promise<ClaudeCliResponse>;
    /**
     * Build CLI arguments from request
     * Returns args array and optional temp file path (caller must clean up)
     * Always uses temp file approach to avoid shell escaping issues on Windows
     */
    private buildArgs;
    /**
     * Map full model names to CLI aliases
     */
    private mapModelName;
    /**
     * Run a CLI command and return the result
     * Uses execSync which works reliably on Windows (spawn with pipes hangs)
     */
    private runCommand;
}
export declare const claudeCliService: ClaudeCliService;
//# sourceMappingURL=claude-cli-service.d.ts.map